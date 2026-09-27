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
  /** Cadeia de modelos a tentar em ordem (fallback automático). */
  models: string[];
  /** Modelo preferido (para exibição/diagnóstico). */
  preferredModel: string;
}

interface ProviderSpec {
  name: string;
  envKey: string;
  baseUrl: string;
  /** Cadeia de modelos tentados em ordem (resiliência a deprecações). */
  defaultModels: string[];
  /** Modelo preferido (primeiro da cadeia) — usado no health/diagnóstico. */
  defaultModel: string;
}

const PROVIDER_SPECS: ProviderSpec[] = [
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    // Cadeia de modelos: tentamos na ordem. Modelos na Groq são descontinuados
    // com frequência (llama-3.3-70b-versatile saiu do ar em 16/08/2026 e deixou
    // o copiloto mudo em produção). O primeiro da lista é o padrão atual de
    // produção da Groq; os seguintes cobrem contas antigas/regionais e o modelo
    // legado ainda ativo em alguns planos. GROQ_MODEL sobrepõe a cadeia.
    defaultModels: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'],
    defaultModel: 'openai/gpt-oss-120b',
  },
  {
    name: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: ['meta-llama/llama-3.3-70b-instruct:free', 'openai/gpt-oss-20b:free'],
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  {
    name: 'mistral',
    envKey: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModels: ['mistral-small-latest'],
    defaultModel: 'mistral-small-latest',
  },
  {
    name: 'cerebras',
    envKey: 'CEREBRAS_API_KEY',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModels: ['llama-3.3-70b', 'openai/gpt-oss-120b'],
    defaultModel: 'llama-3.3-70b',
  },
  {
    name: 'gemini',
    envKey: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModels: ['gemini-2.5-flash'],
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
        // Com override, a cadeia contém só o modelo escolhido (comportamento
        // determinístico p/ quem precisa fixar versão).
        models: modelOverride ? [modelOverride] : spec.defaultModels,
        preferredModel: modelOverride || spec.defaultModel,
      };
    }
  }
  return null;
}

/** Modelo preferido do provedor ativo (para health/diagnóstico). */
export function resolvePreferredModel(): string | null {
  const provider = resolveCompatProvider();
  if (!provider) return null;
  const override = process.env[`${provider.name.toUpperCase()}_MODEL`];
  return override || provider.preferredModel;
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
  /** Modelo que efetivamente respondeu (observabilidade). */
  model?: string;
}

/**
 * Chat completion no formato OpenAI-compatible.
 * Recebe o mesmo formato de `contents` do Gemini (user/model + parts.text)
 * e traduz para {role: system/user/assistant}.
 *
 * Tenta a CADEIA de modelos do provedor em ordem: se um modelo foi descontinuado
 * (404/400 model_not_found) ou indisponível (503), tenta o próximo antes de
 * desistir — assim uma deprecação da Groq nunca mais deixa o copiloto mudo.
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

  let lastError = '';

  for (const model of provider.models) {
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        lastError = `HTTP ${res.status} (${model}): ${body.slice(0, 200)}`;
        console.error(`[LLM:${provider.name}] Falha ${lastError}`);
        // 401/403 = chave inválida: nenhum outro modelo resolverá — abortar.
        if (res.status === 401 || res.status === 403) return null;
        continue; // tenta o próximo modelo da cadeia
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) {
        lastError = `Resposta sem conteúdo (${model})`;
        console.error(`[LLM:${provider.name}] ${lastError}`);
        continue;
      }
      return { text, provider: provider.name, model };
    } catch (err) {
      lastError = `Erro de rede (${model}): ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[LLM:${provider.name}] ${lastError}`);
      continue;
    }
  }

  console.error(`[LLM:${provider.name}] Todos os modelos da cadeia falharam. Último erro: ${lastError}`);
  return null;
}
