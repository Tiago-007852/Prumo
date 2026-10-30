import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateCopilotoReply } from './_lib/copiloto';
import { loadSystemPrompt } from './_lib/systemPrompt';
import { requireUser } from './_lib/http';
import { checkRateLimit, rateLimitMessage } from './_lib/rateLimit';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // Sem sessão, isto seria um proxy grátis para a API de IA (custo e abuso).
  const user = await requireUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Entre na sua conta para usar o copiloto.' });
  }

  // 20 perguntas por 5 minutos por conta — generoso para conversa, apertado
  // para automação.
  const limit = await checkRateLimit(`copilot:${user.id}`, 20, 300);
  if (!limit.allowed) {
    return res.status(429).json({ error: rateLimitMessage(limit) });
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
