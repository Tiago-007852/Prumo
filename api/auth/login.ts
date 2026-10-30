import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loginUser, SESSION_COOKIE } from '../_lib/auth';
import { checkRateLimit, clientIp, rateLimitMessage } from '../_lib/rateLimit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // Freio a credential stuffing: 10 tentativas por IP a cada 10 minutos.
  const ip = clientIp(req.headers as unknown as Record<string, unknown>, (req as unknown as { ip?: string }).ip);
  const limit = await checkRateLimit(`login:${ip}`, 10, 600);
  if (!limit.allowed) {
    return res.status(429).json({ error: rateLimitMessage(limit) });
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
