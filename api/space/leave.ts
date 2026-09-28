import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized } from '../_lib/http';
import { leaveSpace } from '../_lib/space';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  try {
    await leaveSpace(user.id);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Erro ao sair do espaço (serverless):', err);
    return res.status(400).json({ error: err?.message || 'Falha ao sair do espaço' });
  }
}
