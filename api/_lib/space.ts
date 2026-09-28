/**
 * Espaço compartilhado (casal/família) — Fase 3.
 *
 * Modelo mínimo sem migration: tabela `shared_spaces` criada idempotentemente
 * por ensureSchema. Um espaço tem dono (owner), código de convite de 8 chars
 * e membros referenciando users existentes. Os dados financeiros continuam
 * no estado JSONB de cada usuário; o espaço orquestra quem participa.
 */
import { randomBytes } from 'crypto';
import { getSql, ensureSchema } from './db';

export interface SpaceMemberRow {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface SharedSpaceRow {
  id: string;
  name: string;
  ownerUserId: string;
  country: 'BR' | 'AO';
  inviteCode: string;
  members: SpaceMemberRow[];
  createdAt: string;
}

const MAX_MEMBERS = 6;

/** Cria as tabelas do espaço compartilhado (idempotente). */
export async function ensureSpaceSchema(): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS shared_spaces (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      country      TEXT NOT NULL DEFAULT 'BR',
      invite_code  TEXT NOT NULL UNIQUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS shared_space_members (
      space_id   TEXT NOT NULL REFERENCES shared_spaces(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'member',
      joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (space_id, user_id)
    )
  `;
}

function newInviteCode(): string {
  // 8 caracteres sem caracteres ambíguos (0/O, 1/I) — fácil de ditar.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

/** Cria um novo espaço com o usuário como dono. */
export async function createSpace(
  owner: { id: string; name: string; email: string; country: 'BR' | 'AO' },
  name: string
): Promise<SharedSpaceRow> {
  await ensureSpaceSchema();
  const sql = getSql();
  const trimmedName = String(name || '').trim().slice(0, 60);
  if (!trimmedName) throw new Error('Dê um nome ao espaço (ex: "Casa", "Família")');

  // Um usuário pode ser dono de no máximo 1 espaço ativo (simplicidade casal).
  const existingOwner = await sql`
    SELECT id FROM shared_spaces WHERE owner_user_id = ${owner.id} LIMIT 1
  `;
  if (existingOwner.length > 0) {
    throw new Error('Você já é dono de um espaço compartilhado');
  }

  const id = `space_${randomBytes(6).toString('hex')}`;
  const code = newInviteCode();

  await sql`
    INSERT INTO shared_spaces (id, name, owner_user_id, country, invite_code)
    VALUES (${id}, ${trimmedName}, ${owner.id}, ${owner.country}, ${code})
  `;
  await sql`
    INSERT INTO shared_space_members (space_id, user_id, role)
    VALUES (${id}, ${owner.id}, 'owner')
  `;

  return (await getSpaceByUserId(owner.id))!;
}

/** Busca o espaço do usuário (como dono ou membro), com membros. */
export async function getSpaceByUserId(userId: string): Promise<SharedSpaceRow | null> {
  await ensureSpaceSchema();
  const sql = getSql();
  const spaceRows = await sql`
    SELECT s.id, s.name, s.owner_user_id, s.country, s.invite_code, s.created_at
    FROM shared_spaces s
    JOIN shared_space_members m ON m.space_id = s.id AND m.user_id = ${userId}
    LIMIT 1
  `;
  if (spaceRows.length === 0) return null;
  const row = spaceRows[0] as {
    id: string;
    name: string;
    owner_user_id: string;
    country: string;
    invite_code: string;
    created_at: string;
  };

  const memberRows = await sql`
    SELECT m.user_id, m.role, m.joined_at, u.name, u.email
    FROM shared_space_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.space_id = ${row.id}
    ORDER BY m.joined_at ASC
  `;

  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    country: row.country === 'AO' ? 'AO' : 'BR',
    inviteCode: row.invite_code,
    createdAt: new Date(row.created_at).toISOString(),
    members: memberRows.map((mm: Record<string, unknown>) => ({
      userId: String(mm.user_id),
      name: String(mm.name),
      email: String(mm.email),
      role: mm.role === 'owner' ? 'owner' : 'member',
      joinedAt: new Date(String(mm.joined_at)).toISOString(),
    })),
  };
}

/** Entra num espaço pelo código de convite. */
export async function joinSpace(
  user: { id: string; name: string; email: string },
  code: string
): Promise<SharedSpaceRow> {
  await ensureSpaceSchema();
  const sql = getSql();
  const normalized = String(code || '').trim().toUpperCase();
  if (normalized.length < 6) throw new Error('Código de convite inválido');

  const spaceRows = await sql`
    SELECT id FROM shared_spaces WHERE invite_code = ${normalized} LIMIT 1
  `;
  if (spaceRows.length === 0) throw new Error('Código de convite não encontrado');

  const spaceId = spaceRows[0].id as string;

  const memberCount = await sql`
    SELECT COUNT(*)::int AS count FROM shared_space_members WHERE space_id = ${spaceId}
  `;
  const count = Number((memberCount[0] as { count: number }).count);
  if (count >= MAX_MEMBERS) {
    throw new Error(`Este espaço já tem o máximo de ${MAX_MEMBERS} membros`);
  }

  // Já é membro? idempotente: apenas retorna o espaço.
  const already = await sql`
    SELECT 1 FROM shared_space_members WHERE space_id = ${spaceId} AND user_id = ${user.id} LIMIT 1
  `;
  if (already.length === 0) {
    // Usuário que já é dono de outro espaço não pode entrar em outro.
    const ownSpace = await sql`
      SELECT id FROM shared_spaces WHERE owner_user_id = ${user.id} LIMIT 1
    `;
    if (ownSpace.length > 0) {
      throw new Error('Você já tem um espaço próprio — saia dele antes de entrar em outro');
    }
    await sql`
      INSERT INTO shared_space_members (space_id, user_id, role)
      VALUES (${spaceId}, ${user.id}, 'member')
    `;
  }

  return (await getSpaceByUserId(user.id))!;
}

/** Sai do espaço (membro) ou encerra (dono remove a todos e o espaço). */
export async function leaveSpace(userId: string): Promise<{ ok: true }> {
  await ensureSpaceSchema();
  const sql = getSql();
  const space = await getSpaceByUserId(userId);
  if (!space) return { ok: true };

  if (space.ownerUserId === userId) {
    // Dono encerra o espaço inteiro (membros saem via CASCADE).
    await sql`DELETE FROM shared_spaces WHERE id = ${space.id}`;
  } else {
    await sql`DELETE FROM shared_space_members WHERE space_id = ${space.id} AND user_id = ${userId}`;
  }
  return { ok: true };
}

/** Resumo agregado de todos os membros (saldo + gasto do mês) para o painel. */
export async function getSpaceSummary(
  spaceId: string
): Promise<Array<{ userId: string; name: string; role: string; balance: number; monthExpense: number }>> {
  await ensureSpaceSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT m.user_id, m.role, u.name, s.state
    FROM shared_space_members m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN user_state s ON s.user_id = m.user_id
    WHERE m.space_id = ${spaceId}
    ORDER BY m.joined_at ASC
  `;
  return rows.map((r: Record<string, unknown>) => {
    const state = (r.state && typeof r.state === 'object' ? r.state : {}) as Record<string, unknown>;
    const accounts = Array.isArray(state.accounts) ? state.accounts : [];
    const transactions = Array.isArray(state.transactions) ? state.transactions : [];

    let balance = 0;
    for (const a of accounts) {
      const acc = a as { balance?: unknown };
      const v = Number(acc?.balance);
      if (!isNaN(v)) balance += v;
    }

    const now = new Date();
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let monthExpense = 0;
    for (const t of transactions) {
      const tx = t as { type?: unknown; amount?: unknown; occurredAt?: unknown };
      if (tx.type !== 'expense') continue;
      const d = typeof tx.occurredAt === 'string' ? tx.occurredAt.slice(0, 7) : '';
      if (d !== mk) continue;
      const v = Number(tx.amount);
      if (!isNaN(v)) monthExpense += Math.abs(v);
    }

    return {
      userId: String(r.user_id),
      name: String(r.name),
      role: r.role === 'owner' ? 'owner' : 'member',
      balance,
      monthExpense,
    };
  });
}

export const spaceInternals = { newInviteCode, MAX_MEMBERS };
