/**
 * Cliente LLM genérico "OpenAI-compatible" para o Prumo.
 * Permite trocar o provedor de IA apenas com variáveis de ambiente — sem
 * novas dependências (usa fetch nativo).
 *
 * Ordem de prioridade (primeira chave presente vence):
 *   1. GROQ_API_KEY      — free tier generoso, muito rápido (Llama 3.3 70B)
 *   2. OPENROUTER_API_KEY— dezenas de modelos com sufixo ":free"
 *   3. MISTRAL_API_KEY   — plano gratuito experimental (UE, bom p/ LGPD)
 *   4. CEREBRAS_API_KEY  — free tier com inferência extremamente rápida
 *   5. GEMINI_API_KEY    — tratado pelo SDK @google/genai em lib/copiloto.ts
 *                          (aqui só como compat-OpenAI se o SDK falhar)
 *
 * Override de modelo por provedor: GROQ_MODEL, OPENROUTER_MODEL, etc.
 */

export interface CompatProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ProviderSpec {
  name: string;
  envKey: string;
  baseUrl: string;
  defaultModel: string;
}

const PROVIDER_SPECS: ProviderSpec[] = [
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    name: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  {
    name: 'mistral',
    envKey: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
  },
  {
    name: 'cerebras',
    envKey: 'CEREBRAS_API_KEY',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama-3.3-70b',
  },
  {
    name: 'gemini',
    envKey: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
  },
];

/** Resolve o provedor OpenAI-compatible ativo (ou null se nenhum configurado). */
export function resolveCompatProvider(): CompatProvider | null {
  for (const spec of PROVIDER_SPECS) {
    const apiKey = process.env[spec.envKey];
    if (apiKey) {
      const modelOverride = process.env[`${spec.name.toUpperCase()}_MODEL`];
      return {
        name: spec.name,
        baseUrl: spec.baseUrl,
        apiKey,
        model: modelOverride || spec.defaultModel,
      };
    }
  }
  return null;
}

/** Nome do provedor de IA configurado (para health checks/diagnóstico). */
export function resolveAiProviderName(): string | null {
  return resolveCompatProvider()?.name ?? null;
}

export interface LLMContentTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface LLMResult {
  text: string;
  provider: string;
}

/**
 * Chat completion no formato OpenAI-compatible.
 * Recebe o mesmo formato de `contents` do Gemini (user/model + parts.text)
 * e traduz para {role: system/user/assistant}.
 */
export async function chatComplete(
  systemInstruction: string,
  contents: LLMContentTurn[]
): Promise<LLMResult | null> {
  const provider = resolveCompatProvider();
  if (!provider) return null;

  const messages = [
    { role: 'system', content: systemInstruction },
    ...contents.map((turn) => ({
      role: turn.role === 'model' ? ('assistant' as const) : ('user' as const),
      content: turn.parts.map((p) => p.text).join('\n'),
    })),
  ];

  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        `[LLM:${provider.name}] Falha HTTP ${res.status} ao chamar chat/completions:`,
        body.slice(0, 300)
      );
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      console.error(`[LLM:${provider.name}] Resposta sem conteúdo.`);
      return null;
    }
    return { text, provider: provider.name };
  } catch (err) {
    console.error(`[LLM:${provider.name}] Erro de rede:`, err);
    return null;
  }
}
