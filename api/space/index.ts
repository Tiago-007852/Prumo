import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized, parseBody } from '../_lib/http';
import { createSpace, getSpaceByUserId, joinSpace, leaveSpace, getSpaceSummary } from '../_lib/space';

/**
 * Espaço compartilhado (casal/família) — todas as ações numa única serverless,
 * para respeitar o limite de 12 funções do plano Hobby da Vercel.
 *
 *   GET  /api/space                          → espaço atual + resumo dos membros
 *   POST /api/space { name }                 → cria um espaço (dono)
 *   POST /api/space { action: 'join', code } → entra num espaço pelo código
 *   POST /api/space { action: 'leave' }      → sai (membro) ou encerra (dono)
 */
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
      const action = String(body.action || 'create');

      if (action === 'join') {
        const space = await joinSpace(user, String(body.code || ''));
        const summary = await getSpaceSummary(space.id);
        return res.status(200).json({ space, summary });
      }

      if (action === 'leave') {
        await leaveSpace(user.id);
        return res.status(200).json({ ok: true });
      }

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
