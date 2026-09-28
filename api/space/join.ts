import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized, parseBody } from '../_lib/http';
import { joinSpace, getSpaceSummary } from '../_lib/space';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  try {
    const body = parseBody(req.body);
    const space = await joinSpace(user, String(body.code || ''));
    const summary = await getSpaceSummary(space.id);
    return res.status(200).json({ space, summary });
  } catch (err: any) {
    console.error('Erro ao entrar no espaço (serverless):', err);
    return res.status(400).json({ error: err?.message || 'Falha ao entrar no espaço' });
  }
}
