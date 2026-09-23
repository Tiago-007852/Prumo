import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserByToken } from '../_lib/auth';
import { readSessionToken } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  const user = await getUserByToken(readSessionToken(req.headers.cookie));
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  return res.status(200).json({ user });
}
