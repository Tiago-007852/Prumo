import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized } from '../_lib/http';
import { saveUserState } from '../_lib/userData';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  try {
    const result = await saveUserState(user.id, user.country, req.body);
    return res.status(200).json({ ok: true, savedAt: result.savedAt });
  } catch (err: any) {
    console.error('Erro no sync push (serverless):', err);
    return res.status(500).json({ error: err?.message || 'Falha ao sincronizar' });
  }
}
