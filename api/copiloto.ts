import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateCopilotoReply } from '../lib/copiloto';
import { loadSystemPrompt } from '../lib/systemPrompt';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    const result = await generateCopilotoReply(
      {
        message: body.message,
        question: body.question,
        snapshot: body.snapshot,
        financialPortraitMarkdown: body.financialPortraitMarkdown,
        country: body.country,
        history: body.history || body.conversationHistory,
      },
      {
        systemPrompt: loadSystemPrompt(),
        getGemini: () => {
          if (!process.env.GEMINI_API_KEY) return null;
          return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        },
      }
    );

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Erro no copiloto (serverless):', err);
    const isMissing = err?.message === 'Pergunta obrigatória';
    return res.status(isMissing ? 400 : 500).json({
      error: err?.message || 'Falha ao processar resposta do copiloto',
    });
  }
}
