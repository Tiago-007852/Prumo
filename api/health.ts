import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveAiProviderName, resolvePreferredModel } from './_lib/llm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  return res.status(200).json({
    status: 'ok',
    app: 'Prumo',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    aiProvider: resolveAiProviderName() || (!!process.env.GEMINI_API_KEY ? 'gemini' : null),
    aiModel: resolvePreferredModel(),
    databaseConfigured: !!process.env.DATABASE_URL,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  });
}
