import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SESSION_COOKIE, destroySession } from '../_lib/auth';
import { readSessionToken } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const token = readSessionToken(req.headers.cookie);
    await destroySession(token);
  } catch (err) {
    console.error('Erro no logout (serverless):', err);
  }

  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
  return res.status(200).json({ ok: true });
}
