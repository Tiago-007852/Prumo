/**
 * Estado consolidado do usuário no Neon (tabela user_state).
 * Guarda o snapshot completo (user/profile/accounts/transactions/budgets/goals/
 * scenario events/chat) como JSONB — espelha o CountryDataState do frontend.
 * Compartilhado entre server.ts e as funções serverless (api/).
 */
import { getSql, ensureSchema } from './db';

export interface StoredUserState {
  user: unknown;
  accounts: unknown[];
  transactions: unknown[];
  budgetLimits: unknown[];
  scenarioEvents: unknown[];
  chatMessages: unknown[];
  goals: unknown[];
  lastSavedAt?: string;
  offlineQueue?: unknown[];
}

export function sanitizeState(input: unknown): StoredUserState | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;

  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const rawUser = (o.user && typeof o.user === 'object') ? o.user : {};
  const u = rawUser as Record<string, unknown>;

  return {
    user: {
      name: String(u.name || '').slice(0, 120),
      country: u.country === 'AO' ? 'AO' : 'BR',
      locale: String(u.locale || '').slice(0, 10),
      profile: (u.profile && typeof u.profile === 'object') ? u.profile : {},
      twoFactorEnabled: !!u.twoFactorEnabled,
    },
    accounts: arr(o.accounts).slice(0, 100),
    transactions: arr(o.transactions).slice(0, 5000),
    budgetLimits: arr(o.budgetLimits).slice(0, 200),
    scenarioEvents: arr(o.scenarioEvents).slice(0, 200),
    chatMessages: arr(o.chatMessages).slice(0, 1000),
    goals: arr(o.goals).slice(0, 100),
    offlineQueue: arr(o.offlineQueue).slice(0, 500),
    lastSavedAt: typeof o.lastSavedAt === 'string' ? o.lastSavedAt : undefined,
  };
}

/** Salva (upsert) o estado consolidado do usuário. */
export async function saveUserState(
  userId: string,
  country: 'BR' | 'AO',
  state: unknown
): Promise<{ savedAt: string }> {
  await ensureSchema();
  const clean = sanitizeState(state);
  if (!clean) throw new Error('Estado inválido');

  const savedAt = new Date().toISOString();
  const sql = getSql();
  await sql`
    INSERT INTO user_state (user_id, country, state, updated_at)
    VALUES (${userId}, ${country}, ${JSON.stringify(clean)}, now())
    ON CONFLICT (user_id)
    DO UPDATE SET country = EXCLUDED.country, state = EXCLUDED.state, updated_at = now()
  `;
  return { savedAt };
}

/** Carrega o estado consolidado (ou null se nunca sincronizado). */
export async function loadUserState(userId: string): Promise<{ state: StoredUserState | null; updatedAt: string | null }> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT state, updated_at FROM user_state WHERE user_id = ${userId} LIMIT 1
  `;
  if (rows.length === 0) return { state: null, updatedAt: null };
  const row = rows[0] as { state: StoredUserState; updated_at: string };
  return { state: row.state || null, updatedAt: row.updated_at };
}

/** Exporta todos os dados do usuário (direito de portabilidade — LGPD art. 18). */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  await ensureSchema();
  const sql = getSql();
  const userRows = await sql`
    SELECT id, email, name, country, created_at FROM users WHERE id = ${userId} LIMIT 1
  `;
  const stateRows = await sql`
    SELECT state, updated_at FROM user_state WHERE user_id = ${userId} LIMIT 1
  `;
  return {
    exportedAt: new Date().toISOString(),
    account: userRows[0] || null,
    state: stateRows[0] || null,
  };
}

/** Elimina TODOS os dados do usuário (direito de eliminação — LGPD art. 16/18). */
export async function deleteUserData(userId: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  // sessions e user_state têm ON DELETE CASCADE a partir de users
  await sql`DELETE FROM users WHERE id = ${userId}`;
}
