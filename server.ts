import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { categorizeDescription } from './api/_lib/categorize';
import { generateCopilotoReply } from './api/_lib/copiloto';
import { loadSystemPrompt } from './api/_lib/systemPrompt';
import { resolveAiProviderName, resolvePreferredModel } from './api/_lib/llm';
import {
  registerUser,
  loginUser,
  getUserByToken,
  destroySession,
  googleLoginUser,
  isGoogleAuthConfigured,
  SESSION_COOKIE,
} from './api/_lib/auth';
import { saveUserState, loadUserState, exportUserData, deleteUserData } from './api/_lib/userData';
import { requireUser } from './api/_lib/http';
import { createSpace, getSpaceByUserId, joinSpace, leaveSpace, getSpaceSummary } from './api/_lib/space';
import { isPluggyConfigured, createConnectToken } from './api/_lib/pluggy';
import {
  confirmPayment,
  activateWithCode,
  createCheckoutSession,
  getAccess,
  ensurePaymentsSchema,
} from './api/_lib/payments';
import {
  isAdminEmail,
  requireAdmin,
  getAdminKpis,
  adminGenerateCodes,
  adminListCodes,
  adminSearchUsers,
  adminExpiringSoon,
  adminExtendAccess,
  adminRevokeAccess,
  adminRecentActions,
} from './api/_lib/admin';

/** Envolve um handler admin (Express): 403/401 com a mensagem certa. */
async function adminActionExpress(
  res: import('express').Response,
  user: { id: string; email: string },
  fn: () => Promise<unknown>
) {
  try {
    requireAdmin(user);
    const data = await fn();
    return res.json({ ok: true, data });
  } catch (err: any) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Falha na operação admin' });
  }
}

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// ─── Autenticação (mesmo contrato das funções serverless em api/) ───

app.post('/api/auth/register', async (req, res) => {
  try {
    const { user, token, expiresAt } = await registerUser({
      email: req.body?.email,
      password: req.body?.password,
      name: req.body?.name,
      country: req.body?.country,
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
    return res.status(201).json({ user });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Falha ao criar conta' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { user, token, expiresAt } = await loginUser({
      email: req.body?.email,
      password: req.body?.password,
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
    return res.status(200).json({ user });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Email ou senha incorretos' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await destroySession(readToken(req.headers.cookie));
  } catch (err) {
    console.error('Erro no logout:', err);
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  return res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const user = await getUserByToken(readToken(req.headers.cookie));
  if (!user) return res.status(401).json({ error: 'Não autenticado' });
  try {
    // Migração idempotente das colunas de acesso + estado do paywall (Fase 5).
    // Colunas novas nascem com has_access = true — usuários antigos grandfathered.
    await ensurePaymentsSchema();
    const access = await getAccess(user.id);
    // Painel Admin: flag para mostrar/ocultar a tab (verificação real nas actions)
    return res.json({ user, access, isAdmin: isAdminEmail(user.email) });
  } catch (err: any) {
    console.error('Erro ao carregar acesso (/me):', err);
    // Falha de schema/pagamentos não pode derrubar o login — degrade aberto.
    return res.json({ user, access: { hasAccess: true, accessUntil: null, stripeConfigured: false, priceConfigured: false } });
  }
});

// ─── Sync do estado offline-first ───

// ─── Login com Google (Fase 6) ───

app.post('/api/sync', async (req, res) => {
  try {
    // ─── Login com Google (rota pública, corre antes do requireUser) ───
    if (req.body?.action === 'google_auth') {
      try {
        const result = await googleLoginUser({ idToken: req.body.idToken });
        res.setHeader(
          'Set-Cookie',
          `${SESSION_COOKIE}=${result.token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${result.expiresAt.toUTCString()}`
        );
        return res.json({ user: result.user });
      } catch (gErr: any) {
        const status = gErr?.code === 'not_configured' ? 501 : 401;
        return res.status(status).json({ error: gErr?.message || 'Falha no login com Google', configured: gErr?.code !== 'not_configured' });
      }
    }
  } catch (outerErr: any) {
    console.error('Erro no pre-auth do sync:', outerErr);
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  try {
    // ─── Ações de pagamento (Fase 5) viajam na mesma rota para não nascer
    // uma 13ª serverless — o corpo de push de estado não tem `action` ───
    if (req.body?.action === 'checkout_start') {
      try {
        const session = await createCheckoutSession(user.id);
        return res.json({ ok: true, url: session.url, sessionId: session.sessionId });
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
        return res.json({ ok: true, accessUntil: result.accessUntil, recurring: result.recurring });
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
        return res.json({ ok: true, accessUntil });
      } catch (codeErr: any) {
        if (codeErr?.code === 'not_configured') {
          return res.status(501).json({ error: codeErr.message, configured: false });
        }
        return res.status(400).json({ error: codeErr?.message || 'Código inválido' });
      }
    }

    // ─── Painel Admin (Fase A) — requireAdmin no servidor ───
    if (req.body?.action === 'admin_kpis') {
      return adminActionExpress(res, user, () => getAdminKpis());
    }
    if (req.body?.action === 'admin_codes_generate') {
      return adminActionExpress(res, user, () =>
        adminGenerateCodes(user.email, Number(req.body.count), Number(req.body.days), req.body.note)
      );
    }
    if (req.body?.action === 'admin_codes_list') {
      return adminActionExpress(res, user, () => adminListCodes(Number(req.body.limit) || 50));
    }
    if (req.body?.action === 'admin_users_search') {
      return adminActionExpress(res, user, () => adminSearchUsers(String(req.body.query || ''), Number(req.body.limit) || 20));
    }
    if (req.body?.action === 'admin_users_expiring') {
      return adminActionExpress(res, user, () => adminExpiringSoon(Number(req.body.days) || 7));
    }
    if (req.body?.action === 'admin_user_extend') {
      return adminActionExpress(res, user, () => adminExtendAccess(user.email, String(req.body.userId), Number(req.body.days)));
    }
    if (req.body?.action === 'admin_user_revoke') {
      return adminActionExpress(res, user, () => adminRevokeAccess(user.email, String(req.body.userId)));
    }
    if (req.body?.action === 'admin_audit') {
      return adminActionExpress(res, user, () => adminRecentActions(Number(req.body.limit) || 30));
    }

    const result = await saveUserState(user.id, user.country, req.body);
    return res.json({ ok: true, savedAt: result.savedAt });
  } catch (err: any) {
    console.error('Erro no sync push:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao sincronizar' });
  }
});

app.get('/api/sync', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  try {
    const { state, updatedAt } = await loadUserState(user.id);
    return res.json({ state, updatedAt });
  } catch (err: any) {
    console.error('Erro no sync pull:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao carregar dados' });
  }
});

// ─── Espaço compartilhado (casal/família — Fase 3) ───

app.get('/api/space', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  try {
    const space = await getSpaceByUserId(user.id);
    if (!space) return res.json({ space: null });
    const summary = await getSpaceSummary(space.id);
    return res.json({ space, summary });
  } catch (err: any) {
    console.error('Erro ao carregar espaço:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao carregar espaço' });
  }
});

app.post('/api/space', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  try {
    const action = String(req.body?.action || 'create');

    if (action === 'join') {
      const space = await joinSpace(user, req.body?.code);
      const summary = await getSpaceSummary(space.id);
      return res.json({ space, summary });
    }

    if (action === 'leave') {
      await leaveSpace(user.id);
      return res.json({ ok: true });
    }

    const space = await createSpace(user, req.body?.name);
    const summary = await getSpaceSummary(space.id);
    return res.status(201).json({ space, summary });
  } catch (err: any) {
    console.error('Erro ao gerenciar espaço:', err);
    return res.status(400).json({ error: err?.message || 'Falha ao gerenciar espaço' });
  }
});

// ─── Open Finance (Pluggy) — Fase 4 ───

app.post('/api/openfinance', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  if (!isPluggyConfigured()) {
    return res.status(501).json({
      configured: false,
      error: 'Open Finance não configurado (PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET ausentes).',
    });
  }
  try {
    const { accessToken } = await createConnectToken(user.id);
    return res.json({ configured: true, connectToken: accessToken });
  } catch (err: any) {
    console.error('Erro ao gerar connect token:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao iniciar conexão' });
  }
});

app.get('/api/openfinance', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  if (!isPluggyConfigured()) {
    return res.status(501).json({ configured: false, error: 'Open Finance não configurado.' });
  }
  try {
    const itemId = String(req.query.accounts || req.query.transactions || '');
    if (!itemId) return res.status(400).json({ error: 'Informe ?accounts=<itemId> ou ?transactions=<itemId>.' });
    const { pluggyGet } = await import('./api/_lib/pluggy');
    if (req.query.accounts) {
      const accountsRes = await pluggyGet<{ results: unknown[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
      return res.json({ accounts: accountsRes.results || [] });
    }
    const txRes = await pluggyGet<{ results: unknown[] }>(`/transactions?itemId=${encodeURIComponent(itemId)}&pageSize=100`);
    return res.json({ transactions: txRes.results || [] });
  } catch (err: any) {
    console.error('Erro no Open Finance:', err);
    return res.status(500).json({ error: err?.message || 'Falha no Open Finance' });
  }
});

// ─── Direitos LGPD ───

app.get('/api/account/export', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  try {
    const data = await exportUserData(user.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="prumo_meus_dados_${user.id}.json"`);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao exportar dados' });
  }
});

app.post('/api/account/delete', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  if (req.body?.confirm !== user.email) {
    return res.status(400).json({ error: 'Confirmação obrigatória: envie { confirm: email }' });
  }
  try {
    await deleteUserData(user.id);
    await destroySession(readToken(req.headers.cookie));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return res.json({ ok: true, message: 'Conta e dados eliminados permanentemente.' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao eliminar conta' });
  }
});

function readToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE) return rest.join('=');
  }
  return null;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Prumo',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    aiProvider: resolveAiProviderName() || (!!process.env.GEMINI_API_KEY ? 'gemini' : null),
    aiModel: resolvePreferredModel(),
    databaseConfigured: !!process.env.DATABASE_URL,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  });
});

// Endpoint do Copiloto Financeiro com IA (Seção 5 do Brief)
app.post('/api/copiloto', async (req, res) => {
  try {
    const body = req.body || {};

    const result = await generateCopilotoReply(
      {
        message: body.message,
        question: body.question,
        snapshot: body.snapshot,
        financialPortraitMarkdown: body.financialPortraitMarkdown,
        country: body.country,
        history: body.history || body.conversationHistory,
      },
      {
        systemPrompt: loadSystemPrompt(),
        getGemini: getGeminiClient,
      }
    );

    return res.json(result);
  } catch (err: any) {
    console.error('Erro no copiloto:', err);
    const isMissing = err?.message === 'Pergunta obrigatória';
    return res.status(isMissing ? 400 : 500).json({
      error: err?.message || 'Falha ao processar resposta do copiloto',
    });
  }
});

// Endpoint de categorização inteligente automática
app.post('/api/categorize', async (req, res) => {
  try {
    const { description } = req.body || {};
    if (!description) {
      return res.json({ category: 'Outros', confidence: 0.5 });
    }
    return res.json(categorizeDescription(String(description)));
  } catch (err) {
    return res.json({ category: 'Outros', confidence: 0.5 });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Prumo Server rodando em http://localhost:${PORT}`);
  });
}

startServer();
