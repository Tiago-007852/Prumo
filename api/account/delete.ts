import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized, parseBody } from '../../lib/http';
import { deleteUserData } from '../../lib/userData';
import { SESSION_COOKIE, destroySession } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  const body = parseBody(req.body);
  if (body.confirm !== user.email) {
    return res.status(400).json({ error: 'Confirmação obrigatória: envie { confirm: email }' });
  }

  try {
    await deleteUserData(user.id);
    await destroySession(readSessionTokenOf(req));

    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    );
    return res.status(200).json({ ok: true, message: 'Conta e dados eliminados permanentemente.' });
  } catch (err: any) {
    console.error('Erro na eliminação de conta (serverless):', err);
    return res.status(500).json({ error: err?.message || 'Falha ao eliminar conta' });
  }
}

function readSessionTokenOf(req: VercelRequest): string | null {
  const cookie = req.headers.cookie || '';
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE) return rest.join('=');
  }
  return null;
}
