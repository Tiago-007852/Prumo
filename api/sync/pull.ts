import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized } from '../../lib/http';
import { loadUserState } from '../../lib/userData';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  try {
    const { state, updatedAt } = await loadUserState(user.id);
    return res.status(200).json({ state, updatedAt });
  } catch (err: any) {
    console.error('Erro no sync pull (serverless):', err);
    return res.status(500).json({ error: err?.message || 'Falha ao carregar dados' });
  }
}
