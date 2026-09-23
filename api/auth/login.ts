import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loginUser, SESSION_COOKIE } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { user, token, expiresAt } = await loginUser({
      email: req.body?.email,
      password: req.body?.password,
    });

    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}`
    );

    return res.status(200).json({ user });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Email ou senha incorretos' });
  }
}
