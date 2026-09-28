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
  SESSION_COOKIE,
} from './api/_lib/auth';
import { saveUserState, loadUserState, exportUserData, deleteUserData } from './api/_lib/userData';
import { requireUser } from './api/_lib/http';
import { createSpace, getSpaceByUserId, joinSpace, leaveSpace, getSpaceSummary } from './api/_lib/space';

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
  return res.json({ user });
});

// ─── Sync do estado offline-first ───

app.post('/api/sync/push', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  try {
    const result = await saveUserState(user.id, user.country, req.body);
    return res.json({ ok: true, savedAt: result.savedAt });
  } catch (err: any) {
    console.error('Erro no sync push:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao sincronizar' });
  }
});

app.get('/api/sync/pull', async (req, res) => {
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
    const space = await createSpace(user, req.body?.name);
    const summary = await getSpaceSummary(space.id);
    return res.status(201).json({ space, summary });
  } catch (err: any) {
    console.error('Erro ao criar espaço:', err);
    return res.status(400).json({ error: err?.message || 'Falha ao criar espaço' });
  }
});

app.post('/api/space/join', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  try {
    const space = await joinSpace(user, req.body?.code);
    const summary = await getSpaceSummary(space.id);
    return res.json({ space, summary });
  } catch (err: any) {
    console.error('Erro ao entrar no espaço:', err);
    return res.status(400).json({ error: err?.message || 'Falha ao entrar no espaço' });
  }
});

app.post('/api/space/leave', async (req, res) => {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  try {
    await leaveSpace(user.id);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('Erro ao sair do espaço:', err);
    return res.status(400).json({ error: err?.message || 'Falha ao sair do espaço' });
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
