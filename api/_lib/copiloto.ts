/**
 * Núcleo do Copiloto Financeiro (Seção 5 do Brief).
 * Compartilhado entre o servidor Express (server.ts) e as funções serverless (api/).
 * Mantém o prompt de sistema idêntico ao prompts/copiloto-system.md.
 */
import { FinancialSnapshot } from '../../src/types';
import { buildFinancialPortraitMarkdown } from '../../src/services/businessRules';
import { EMBEDDED_SYSTEM_PROMPT } from './systemPrompt';
import { chatComplete, resolveCompatProvider, resolveAiProviderName } from './llm';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotoRequest {
  message?: string;
  question?: string; // legado
  snapshot?: FinancialSnapshot;
  financialPortraitMarkdown?: string; // legado
  country?: 'BR' | 'AO';
  history?: HistoryMessage[];
  conversationHistory?: HistoryMessage[]; // legado
}

const FALLBACK_UNAVAILABLE =
  'Desculpe, não consegui processar a resposta agora. Tente novamente em alguns instantes.';

/**
 * Fallback determinístico usado quando nenhuma chave de IA está configurada
 * (GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY, CEREBRAS_API_KEY ou
 * GEMINI_API_KEY) ou a chamada à API falha. Responde com base no retrato
 * financeiro disponível.
 */
export function buildFallbackReply(req: CopilotoRequest): string {
  const snapshot = req.snapshot;
  const isAO = req.country === 'AO' || snapshot?.user?.country === 'AO';
  const question = req.message || req.question || '';

  let reply = 'Analisando o seu retrato financeiro: ';

  if (/cenario|cenário|simula|simulação|projetar|futuro/i.test(question)) {
    reply += 'Na sua simulação de cenários de 24 meses, manter a consistência de aportes e cortar despesas fixas desnecessárias amplia significativamente a sua reserva. Experimente ativar o evento de corte de custos para ver o reflexo na curva. Que tal revisar seus orçamentos do mês agora?';
  } else if (/reserva|emergencia|emergência/i.test(question)) {
    reply += 'Para a sua profissão, uma reserva de emergência segura deve cobrir de 3 a 6 meses do seu custo de vida básico. Verifique na aba de Metas se a sua meta primária já contempla esse fundo.';
  } else if (/orçamento|gasto|limite|estourou/i.test(question)) {
    reply += 'Acompanhe as categorias com alertas de atenção (>80%) no seu painel. Realoque gastos discricionários para evitar comprometer a sua meta de poupança deste mês.';
  } else {
    const cur = isAO ? 'Kz' : 'R$';
    reply += `Seus dados e transações estão consolidados com sucesso em ${cur}. Posso te ajudar a planejar orçamentos por categoria, interpretar o gráfico de projeção de 24 meses ou sugerir o próximo passo para sua meta principal. Como prefere começar?`;
  }

  return reply;
}

export type CopilotoSource = 'gemini' | 'compat' | 'heuristic_fallback';

export interface CopilotoResult {
  reply: string;
  source: CopilotoSource;
  provider?: string;
  /** Modelo que respondeu (quando a resposta veio de IA de verdade). */
  model?: string;
  /** Diagnóstico curto quando caiu no fallback (observabilidade no cliente). */
  fallbackReason?: string;
}

/**
 * Processa a pergunta do usuário com o provedor de IA ativo (OpenAI-compatible
 * como Groq/OpenRouter/Mistral/Cerebras, ou o SDK Gemini), usando o retrato
 * financeiro como contexto do system instruction.
 * Retorna o fallback heurístico quando nenhuma chave está configurada ou a
 * chamada falha.
 */
export async function generateCopilotoReply(
  req: CopilotoRequest,
  options: { getGemini: () => unknown; systemPrompt: string }
): Promise<CopilotoResult> {
  const { getGemini, systemPrompt } = options;
  const question = req.message || req.question || '';
  const history = req.history || req.conversationHistory || [];

  if (!question) {
    throw new Error('Pergunta obrigatória');
  }

  const ai = getGemini();

  if (resolveCompatProvider() || ai) {
    try {
      const portrait =
        req.financialPortraitMarkdown ||
        (req.snapshot ? buildFinancialPortraitMarkdown(req.snapshot) : null) ||
        'Nenhum dado financeiro disponível no momento.';

      const fullSystemInstruction = `${systemPrompt || EMBEDDED_SYSTEM_PROMPT}

---
${portrait}`;

      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      if (Array.isArray(history) && history.length > 0) {
        for (const msg of history.slice(-6)) {
          if (!msg || !msg.content) continue;
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          });
        }
      }

      contents.push({ role: 'user', parts: [{ text: question }] });

      // Preferência: provedor OpenAI-compatible (Groq/OpenRouter/Mistral/Cerebras)
      // quando configurado; senão, SDK Gemini nativo.
      if (resolveCompatProvider()) {
        const compat = await chatComplete(fullSystemInstruction, contents);
        if (compat) {
          return {
            reply: compat.text,
            source: 'compat',
            provider: compat.provider,
            model: compat.model,
          };
        }
        // Provedor compat falhou: cai para o Gemini SDK se disponível,
        // e depois para o fallback heurístico.
      } else if (ai) {
        const response = await (
          ai as {
            models: {
              generateContent: (args: unknown) => Promise<{ text?: string }>;
            };
          }
        ).models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction: fullSystemInstruction,
            temperature: 0.7,
          },
        });

        const replyText = response?.text || FALLBACK_UNAVAILABLE;
        return { reply: replyText, source: 'gemini' };
      }
    } catch (err) {
      console.error('Erro ao chamar o provedor de IA, usando fallback heurístico:', err);
    }
  }

  // Nenhum provedor disponível OU todas as chamadas falharam: o cliente recebe
  // `source: 'heuristic_fallback'` + `fallbackReason` para exibir um aviso
  // honesto em vez de fingir que a IA respondeu.
  const reason = resolveCompatProvider()
    ? 'Não foi possível alcançar o provedor de IA neste momento.'
    : 'Nenhuma chave de IA está configurada neste ambiente.';
  return { reply: buildFallbackReply(req), source: 'heuristic_fallback', fallbackReason: reason };
}
