import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized } from '../_lib/http';
import { loadUserState, saveUserState } from '../_lib/userData';
import { confirmPayment, activateWithCode, createCheckoutSession } from '../_lib/payments';
import { googleLoginUser, SESSION_COOKIE } from '../_lib/auth';
import {
  requireAdmin,
  getAdminKpis,
  adminGenerateCodes,
  adminListCodes,
  adminSearchUsers,
  adminExpiringSoon,
  adminExtendAccess,
  adminRevokeAccess,
  adminRecentActions,
} from '../_lib/admin';

/** Envolve um handler admin: 403/401 com a mensagem certa. */
async function adminAction(res: VercelResponse, user: { id: string; email: string }, fn: () => Promise<unknown>) {
  try {
    requireAdmin(user);
    const data = await fn();
    return res.status(200).json({ ok: true, data });
  } catch (err: any) {
    const status = err?.status || 500;
    return res.status(status).json({ error: err?.message || 'Falha na operação admin' });
  }
}

/**
 * Sync offline-first — pull e push numa única serverless, para respeitar o
 * limite de 12 funções do plano Hobby da Vercel.
 *
 *   GET  /api/sync  → carrega o estado consolidado do usuário (pull)
 *   POST /api/sync  → salva o estado enviado pelo cliente (push)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  try {
    if (req.method === 'GET') {
      const { state, updatedAt } = await loadUserState(user.id);
      return res.status(200).json({ state, updatedAt });
    }

    if (req.method === 'POST') {
      // ─── Login com Google (token GIS validado no servidor) ───
      // Rota pública: corre ANTES do requireUser — é ela que cria a sessão.
      if (req.body?.action === 'google_auth') {
        try {
          const result = await googleLoginUser({ idToken: req.body.idToken });
          res.setHeader(
            'Set-Cookie',
            `${SESSION_COOKIE}=${result.token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${result.expiresAt.toUTCString()}`
          );
          return res.status(200).json({ user: result.user });
        } catch (gErr: any) {
          const status = gErr?.code === 'not_configured' ? 501 : 401;
          return res.status(status).json({ error: gErr?.message || 'Falha no login com Google', configured: gErr?.code !== 'not_configured' });
        }
      }

      // ─── Ações de pagamento (Fase 5) na mesma função — limite de 12 ───
      if (req.body?.action === 'checkout_start') {
        try {
          const session = await createCheckoutSession(user.id);
          return res.status(200).json({ ok: true, url: session.url, sessionId: session.sessionId });
        } catch (coErr: any) {
          if (coErr?.code === 'not_configured') {
            return res.status(501).json({ error: coErr.message, configured: false });
          }
          return res.status(400).json({ error: coErr?.message || 'Falha ao iniciar checkout' });
        }
      }
      if (req.body?.action === 'payment_confirm') {
        const sessionId = String(req.body.sessionId || '');
        try {
          const result = await confirmPayment(user.id, sessionId);
          return res.status(200).json({ ok: true, accessUntil: result.accessUntil, recurring: result.recurring });
        } catch (payErr: any) {
          if (payErr?.code === 'not_configured') {
            return res.status(501).json({ error: payErr.message, configured: false });
          }
          return res.status(400).json({ error: payErr?.message || 'Pagamento não confirmado' });
        }
      }
      if (req.body?.action === 'activate_code') {
        try {
          const accessUntil = await activateWithCode(user.id, String(req.body.code || ''));
          return res.status(200).json({ ok: true, accessUntil });
        } catch (codeErr: any) {
          if (codeErr?.code === 'not_configured') {
            return res.status(501).json({ error: codeErr.message, configured: false });
          }
          return res.status(400).json({ error: codeErr?.message || 'Código inválido' });
        }
      }

      // ─── Painel Admin (Fase A) — requireAdmin no servidor ───
      if (req.body?.action === 'admin_kpis') {
        return adminAction(res, user, () => getAdminKpis());
      }
      if (req.body?.action === 'admin_codes_generate') {
        return adminAction(res, user, () =>
          adminGenerateCodes(user.email, Number(req.body.count), Number(req.body.days), req.body.note)
        );
      }
      if (req.body?.action === 'admin_codes_list') {
        return adminAction(res, user, () => adminListCodes(Number(req.body.limit) || 50));
      }
      if (req.body?.action === 'admin_users_search') {
        return adminAction(res, user, () => adminSearchUsers(String(req.body.query || ''), Number(req.body.limit) || 20));
      }
      if (req.body?.action === 'admin_users_expiring') {
        return adminAction(res, user, () => adminExpiringSoon(Number(req.body.days) || 7));
      }
      if (req.body?.action === 'admin_user_extend') {
        return adminAction(res, user, () => adminExtendAccess(user.email, String(req.body.userId), Number(req.body.days)));
      }
      if (req.body?.action === 'admin_user_revoke') {
        return adminAction(res, user, () => adminRevokeAccess(user.email, String(req.body.userId)));
      }
      if (req.body?.action === 'admin_audit') {
        return adminAction(res, user, () => adminRecentActions(Number(req.body.limit) || 30));
      }

      const result = await saveUserState(user.id, user.country, req.body);
      return res.status(200).json({ ok: true, savedAt: result.savedAt });
    }

    return res.status(405).json({ error: 'Método não permitido. Use GET ou POST.' });
  } catch (err: any) {
    console.error('Erro no sync (serverless):', err);
    return res.status(500).json({ error: err?.message || 'Falha ao sincronizar' });
  }
}
