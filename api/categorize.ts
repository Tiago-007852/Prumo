import type { VercelRequest, VercelResponse } from '@vercel/node';
import { categorizeDescription } from './_lib/categorize';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { description } = body;

    if (!description) {
      return res.status(200).json({ category: 'Outros', confidence: 0.5 });
    }

    return res.status(200).json(categorizeDescription(String(description)));
  } catch (err) {
    console.error('Erro no categorize (serverless):', err);
    return res.status(200).json({ category: 'Outros', confidence: 0.5 });
  }
}
