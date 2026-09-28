/**
 * Open Finance Brasil via Pluggy (Fase 4).
 *
 * O Pluggy é a camada regulada de agregação: o widget de conexão roda no
 * cliente com um connect token de curta duração gerado aqui; saldos e
 * transações vêm da API e são mapeados para os modelos do Prumo.
 *
 * Credenciais (Vercel env): PLUGGY_CLIENT_ID + PLUGGY_CLIENT_SECRET.
 * Sem elas o endpoint responde configured:false e o app segue manual/OFX.
 */

const PLUGGY_API = 'https://api.pluggy.ai';

// Nota: as funções de mapeamento (conta/transação Pluggy → modelo Prumo)
// vivem em src/services/pluggyMapping.ts — o servidor devolve os dados crus
// e o cliente (que tem os tipos do app) faz a conversão.

export interface PluggyConfigured {
  clientId: string;
  clientSecret: string;
}

export function isPluggyConfigured(): boolean {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

/** Gera um connect token de curta duração para o widget Pluggy Connect. */
export async function createConnectToken(userId: string): Promise<{ accessToken: string }> {
  const { clientId, clientSecret } = process.env as unknown as PluggyConfigured;
  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao autenticar no Pluggy (${res.status})`);
  }
  const { apiKey } = (await res.json()) as { apiKey: string };

  // Connect token de 180s vinculado ao usuário (clientUserId rastreia consentimento)
  const tokenRes = await fetch(`${PLUGGY_API}/connect_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ clientUserId: userId, expiresIn: 180 }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Falha ao gerar connect token (${tokenRes.status})`);
  }
  const { accessToken } = (await tokenRes.json()) as { accessToken: string };
  return { accessToken };
}

export async function pluggyGet<T>(path: string): Promise<T> {
  const { clientId, clientSecret } = process.env as unknown as PluggyConfigured;
  const auth = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!auth.ok) throw new Error(`Falha ao autenticar no Pluggy (${auth.status})`);
  const { apiKey } = (await auth.json()) as { apiKey: string };

  const res = await fetch(`${PLUGGY_API}${path}`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!res.ok) throw new Error(`Falha ao consultar Pluggy ${path} (${res.status})`);
  return (await res.json()) as T;
}


