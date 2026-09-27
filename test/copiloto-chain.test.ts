/**
 * Teste de regressão do bug do copiloto (Set/2026): o modelo default da Groq
 * (llama-3.3-70b-versatile) foi descontinuado em 16/08/2026 e TODA chamada
 * falhava, caindo sempre no fallback heurístico ("Analisando o seu retrato
 * financeiro...").
 *
 * Valida a cadeia de modelos do llm.ts:
 * - 404/503 no primeiro modelo → tenta o próximo da cadeia (sucesso)
 * - 401/403 (chave inválida)   → aborta sem tentar os demais
 * - todos os modelos falham    → retorna null (fallback do copiloto)
 */

import { chatComplete } from '../api/_lib/llm';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Test Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

interface FakeRes {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

/**
 * Substitui fetch global por um roteador fake que mapeia o campo `model`
 * do corpo da requisição para uma resposta configurada.
 */
function installFakeFetch(responses: Record<string, { status: number; body?: unknown }>) {
  const calledModels: string[] = [];
  const fake = (async (_url: string | URL | Request, init?: { body?: string }) => {
    const parsed = JSON.parse(init?.body || '{}') as { model?: string };
    const model = parsed.model || '?';
    calledModels.push(model);
    const cfg = responses[model] ?? { status: 404 };
    return {
      ok: cfg.status >= 200 && cfg.status < 300,
      status: cfg.status,
      json: async () => cfg.body ?? {},
      text: async () => JSON.stringify(cfg.body ?? {}),
    } as FakeRes;
  }) as unknown as typeof fetch;

  const originalFetch = global.fetch;
  global.fetch = fake;
  return { calledModels, restore: () => (global.fetch = originalFetch) };
}

const SYSTEM = 'system prompt de teste';
const CONTENTS = [{ role: 'user' as const, parts: [{ text: 'pergunta de teste' }] }];

async function run() {
  console.log('\n--- 🧪 Cadeia de modelos do Copiloto (regressão Groq) ---\n');

  // 1. Primeiro modelo 404 (descontinuado) → segundo responde OK
  {
    const { calledModels, restore } = installFakeFetch({
      'openai/gpt-oss-120b': { status: 404, body: { error: { message: 'model_decommissioned' } } },
      'openai/gpt-oss-20b': {
        status: 200,
        body: { choices: [{ message: { content: 'Resposta vinda do segundo modelo!' } }] },
      },
    });
    process.env.GROQ_API_KEY = 'test-key';
    delete process.env.GROQ_MODEL;
    const result = await chatComplete(SYSTEM, CONTENTS);
    restore();
    assert(result !== null, 'Cadeia recupera de 404 no primeiro modelo');
    assert(result?.text === 'Resposta vinda do segundo modelo!', 'Texto do modelo de fallback retornado');
    assert(result?.model === 'openai/gpt-oss-20b', 'Resultado informa qual modelo respondeu');
    assert(calledModels.length === 2, `Dois modelos tentados (recebido: ${calledModels.join(', ')})`);
  }

  // 2. 503 no primeiro → segundo responde
  {
    const { calledModels, restore } = installFakeFetch({
      'openai/gpt-oss-120b': { status: 503, body: { error: 'overloaded' } },
      'openai/gpt-oss-20b': { status: 200, body: { choices: [{ message: { content: 'ok pós-503' } }] } },
    });
    const result = await chatComplete(SYSTEM, CONTENTS);
    restore();
    assert(result?.text === 'ok pós-503', 'Cadeia recupera de 503');
    assert(calledModels.length === 2, '503 também cai para o próximo modelo');
  }

  // 3. Chave inválida (401) → aborta imediatamente, sem gastar chamadas
  {
    const { calledModels, restore } = installFakeFetch({
      'openai/gpt-oss-120b': { status: 401, body: { error: 'invalid api key' } },
    });
    const result = await chatComplete(SYSTEM, CONTENTS);
    restore();
    assert(result === null, '401 retorna null (sem resposta)');
    assert(calledModels.length === 1, `401 aborta a cadeia (tentado: ${calledModels.length})`);
  }

  // 4. Todos os modelos falham → null
  {
    const { restore } = installFakeFetch({
      'openai/gpt-oss-120b': { status: 404 },
      'openai/gpt-oss-20b': { status: 404 },
      'llama-3.3-70b-versatile': { status: 404 },
    });
    const result = await chatComplete(SYSTEM, CONTENTS);
    restore();
    assert(result === null, 'Todos os modelos falhando → null (copiloto cai no fallback)');
  }

  // 5. GROQ_MODEL fixa a cadeia em um único modelo (determinismo)
  {
    const { calledModels, restore } = installFakeFetch({
      'meu-modelo-custom': { status: 200, body: { choices: [{ message: { content: 'modelo fixado' } }] } },
    });
    process.env.GROQ_MODEL = 'meu-modelo-custom';
    const result = await chatComplete(SYSTEM, CONTENTS);
    restore();
    delete process.env.GROQ_MODEL;
    assert(result?.text === 'modelo fixado', 'GROQ_MODEL sobrepõe a cadeia');
    assert(calledModels.length === 1 && calledModels[0] === 'meu-modelo-custom', 'Override usa apenas o modelo fixado');
  }

  // 6. Resposta 200 sem conteúdo → tenta o próximo
  {
    const { calledModels, restore } = installFakeFetch({
      'openai/gpt-oss-120b': { status: 200, body: { choices: [] } },
      'openai/gpt-oss-20b': { status: 200, body: { choices: [{ message: { content: 'recuperou de vazio' } }] } },
    });
    const result = await chatComplete(SYSTEM, CONTENTS);
    restore();
    assert(result?.text === 'recuperou de vazio', 'Resposta vazia cai para o próximo modelo');
    assert(calledModels.length === 2, 'Resposta vazia conta como falha da cadeia');
  }

  delete process.env.GROQ_API_KEY;

  console.log('\n🎉 TESTES DA CADEIA DE MODELOS PASSARAM!\n');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
