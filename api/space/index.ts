import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized, parseBody } from '../_lib/http';
import { createSpace, getSpaceByUserId, getSpaceSummary } from '../_lib/space';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  try {
    if (req.method === 'GET') {
      const space = await getSpaceByUserId(user.id);
      if (!space) return res.status(200).json({ space: null });
      const summary = await getSpaceSummary(space.id);
      return res.status(200).json({ space, summary });
    }

    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const space = await createSpace(user, String(body.name || ''));
      const summary = await getSpaceSummary(space.id);
      return res.status(201).json({ space, summary });
    }

    return res.status(405).json({ error: 'Método não permitido. Use GET ou POST.' });
  } catch (err: any) {
    console.error('Erro no espaço compartilhado (serverless):', err);
    return res.status(400).json({ error: err?.message || 'Falha ao gerenciar espaço' });
  }
}
