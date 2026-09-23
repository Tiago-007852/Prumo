import type { VercelRequest, VercelResponse } from '@vercel/node';
import { registerUser, SESSION_COOKIE } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { user, token, expiresAt } = await registerUser({
      email: req.body?.email,
      password: req.body?.password,
      name: req.body?.name,
      country: req.body?.country,
    });

    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}`
    );

    return res.status(201).json({ user });
  } catch (err: any) {
    const isValidation = ['Email inválido', 'A senha precisa ter ao menos 8 caracteres', 'Este email já está cadastrado'].includes(err?.message);
    return res.status(isValidation ? 400 : 500).json({ error: err?.message || 'Falha ao criar conta' });
  }
}
