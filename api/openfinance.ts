import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, unauthorized, parseBody } from './_lib/http';
import { isPluggyConfigured, createConnectToken, pluggyGet } from './_lib/pluggy';

/**
 * Open Finance (Pluggy) — serverless única (limite de 12 funções do Hobby).
 *
 *   POST /api/openfinance { action: 'connect_token' } → token do widget
 *   GET  /api/openfinance?accounts=<itemId>           → contas do item
 *   GET  /api/openfinance?transactions=<itemId>       → transações do item
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  if (!user) return unauthorized(res);

  if (!isPluggyConfigured()) {
    return res.status(501).json({
      configured: false,
      error: 'Open Finance não configurado (PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET ausentes).',
    });
  }

  try {
    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const action = String(body.action || 'connect_token');
      if (action !== 'connect_token') {
        return res.status(400).json({ error: 'Ação desconhecida. Use connect_token.' });
      }
      const { accessToken } = await createConnectToken(user.id);
      return res.status(200).json({ configured: true, connectToken: accessToken });
    }

    if (req.method === 'GET') {
      const itemId = String(req.query.accounts || req.query.transactions || '');
      if (!itemId) {
        return res.status(400).json({ error: 'Informe ?accounts=<itemId> ou ?transactions=<itemId>.' });
      }

      if (req.query.accounts) {
        const item = await pluggyGet<{ id?: string; institution?: { name?: string } }>(`/items/${itemId}`).catch(
          () => null
        );
        const accountsRes = await pluggyGet<{ results: unknown[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
        return res.status(200).json({
          item: item ? { id: item.id, institution: item.institution } : null,
          accounts: accountsRes.results || [],
        });
      }

      const txRes = await pluggyGet<{ results: unknown[] }>(
        `/transactions?itemId=${encodeURIComponent(itemId)}&pageSize=100`
      );
      return res.status(200).json({ transactions: txRes.results || [] });
    }

    return res.status(405).json({ error: 'Método não permitido. Use GET ou POST.' });
  } catch (err: any) {
    console.error('Erro no Open Finance (serverless):', err);
    return res.status(500).json({ error: err?.message || 'Falha no Open Finance' });
  }
}
