import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized } from '../_lib/http';
import { loadUserState, saveUserState } from '../_lib/userData';

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
      const result = await saveUserState(user.id, user.country, req.body);
      return res.status(200).json({ ok: true, savedAt: result.savedAt });
    }

    return res.status(405).json({ error: 'Método não permitido. Use GET ou POST.' });
  } catch (err: any) {
    console.error('Erro no sync (serverless):', err);
    return res.status(500).json({ error: err?.message || 'Falha ao sincronizar' });
  }
}
