import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized } from '../_lib/http';
import { loadUserState, saveUserState } from '../_lib/userData';
import { confirmPayment, activateWithCode, createCheckoutSession } from '../_lib/payments';

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

      const result = await saveUserState(user.id, user.country, req.body);
      return res.status(200).json({ ok: true, savedAt: result.savedAt });
    }

    return res.status(405).json({ error: 'Método não permitido. Use GET ou POST.' });
  } catch (err: any) {
    console.error('Erro no sync (serverless):', err);
    return res.status(500).json({ error: err?.message || 'Falha ao sincronizar' });
  }
}
