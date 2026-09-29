/**
 * Painel Admin (Fase A) — server-side.
 *
 * Admin = email em ADMIN_EMAILS (env, separado por vírgulas). Verificação
 * SEMPRE no servidor (requireAdmin) — o cliente só decide se mostra a tab.
 * Todas as ações de escrita ficam registadas em admin_actions (auditoria).
 *
 * Via actions no /api/sync — zero funções serverless novas (limite 12/12).
 */
import { getSql, ensureSchema } from './db';
import { ensureCodesSchema } from './payments';

export function isAdminEmail(email: string | null | undefined): boolean {
  const raw = process.env.ADMIN_EMAILS || '';
  if (!raw.trim()) return false;
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && list.includes(String(email).toLowerCase());
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  country: 'BR' | 'AO';
  isAdmin: boolean;
}

/** Envolvente das actions: 403 se não for admin. */
export function requireAdmin(user: AdminUser | { id: string; email: string } | null): asserts user is AdminUser {
  if (!user) {
    throw Object.assign(new Error('Sessão expirada. Entre novamente.'), { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    throw Object.assign(new Error('Acesso restrito a administradores'), { status: 403 });
  }
}

/* ─── Auditoria ─── */

let _auditSchemaReady: Promise<void> | null = null;

export function ensureAuditSchema(): Promise<void> {
  if (!_auditSchemaReady) {
    _auditSchemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS admin_actions (
          id          SERIAL PRIMARY KEY,
          admin_email TEXT NOT NULL,
          action      TEXT NOT NULL,
          detail      JSONB,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      _auditSchemaReady = null;
      throw err;
    });
  }
  return _auditSchemaReady;
}

async function audit(adminEmail: string, action: string, detail: Record<string, unknown>): Promise<void> {
  await ensureAuditSchema();
  const sql = getSql();
  await sql`
    INSERT INTO admin_actions (admin_email, action, detail)
    VALUES (${adminEmail}, ${action}, ${JSON.stringify(detail)})
  `;
}

/* ─── KPIs da visão geral ─── */

export interface AdminKpis {
  usersTotal: number;
  usersNew7d: number;
  usersActive: number;
  usersBr: number;
  usersAo: number;
  codesAlive: number;
  codesUsed: number;
  mrrEstimateBrl: number;
}

export async function getAdminKpis(): Promise<AdminKpis> {
  await ensureSchema();
  await ensureCodesSchema();
  const sql = getSql();

  const totals = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new7d,
      COUNT(*) FILTER (WHERE country = 'BR')::int AS br,
      COUNT(*) FILTER (WHERE country = 'AO')::int AS ao
    FROM users
  `;
  const active = await sql`
    SELECT COUNT(*)::int AS n FROM users
    WHERE has_access = true
      AND (access_until IS NULL OR access_until > now())
  `;
  const codes = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'novo')::int AS alive,
      COUNT(*) FILTER (WHERE status = 'usado')::int AS used
    FROM activation_codes
  `;
  // MRR estimado: BR = ativos × R$ 29,90; AO = ativos × (4.900 Kz ≈ 29,90 BRL)
  const activeN = Number((active[0] as { n: number })?.n || 0);
  const brN = Number((totals[0] as { br: number })?.br || 0);
  const aoN = Number((totals[0] as { ao: number })?.ao || 0);

  return {
    usersTotal: Number((totals[0] as { total: number })?.total || 0),
    usersNew7d: Number((totals[0] as { new7d: number })?.new7d || 0),
    usersActive: activeN,
    usersBr: brN,
    usersAo: aoN,
    codesAlive: Number((codes[0] as { alive: number })?.alive || 0),
    codesUsed: Number((codes[0] as { used: number })?.used || 0),
    mrrEstimateBrl: Math.round((activeN * 29.9) * 100) / 100,
  };
}

/* ─── Códigos de ativação ─── */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface AdminCodeRow {
  code: string;
  days: number;
  note: string | null;
  status: 'novo' | 'usado';
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

/** Gera um lote de códigos single-use (devolve os criados). */
export async function adminGenerateCodes(
  adminEmail: string,
  count: number,
  days: number,
  note?: string
): Promise<string[]> {
  await ensureCodesSchema();
  const sql = getSql();
  const safeCount = Math.min(Math.max(Math.floor(Number(count) || 0), 1), 200);
  const safeDays = Math.min(Math.max(Math.floor(Number(days) || 31), 1), 365);

  const created: string[] = [];
  let attempts = 0;
  while (created.length < safeCount && attempts < safeCount * 5) {
    attempts++;
    const block = () =>
      Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    const candidate = `PRUMO-${block()}-${block()}-${block()}`;
    const res = await sql`
      INSERT INTO activation_codes (code, days, note)
      VALUES (${candidate}, ${safeDays}, ${note || null})
      ON CONFLICT (code) DO NOTHING
      RETURNING code
    `;
    if (res.length > 0) created.push(candidate);
  }
  await audit(adminEmail, 'codes_generate', { count: created.length, days: safeDays, note: note || null });
  return created;
}

export async function adminListCodes(limit = 50): Promise<AdminCodeRow[]> {
  await ensureCodesSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT code, days, note, status, used_by, used_at, created_at
    FROM activation_codes ORDER BY created_at DESC LIMIT ${Math.min(limit, 200)}
  `;
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    code: String(r.code),
    days: Number(r.days),
    note: (r.note as string) || null,
    status: (r.status as 'novo' | 'usado') || 'novo',
    usedBy: (r.used_by as string) || null,
    usedAt: r.used_at ? new Date(r.used_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

/* ─── Utilizadores (suporte) ─── */

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  country: 'BR' | 'AO';
  hasAccess: boolean;
  accessUntil: string | null;
  createdAt: string;
  lastSyncAt: string | null;
}

export async function adminSearchUsers(query: string, limit = 20): Promise<AdminUserRow[]> {
  await ensureSchema();
  await ensureCodesSchema();
  const sql = getSql();
  const q = String(query || '').trim().toLowerCase();
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const base = sql`
    SELECT u.id, u.email, u.name, u.country, u.has_access, u.access_until, u.created_at,
           (SELECT MAX(updated_at) FROM user_state s WHERE s.user_id = u.id) AS last_sync
    FROM users u
    ${q ? sql`WHERE LOWER(u.email) LIKE ${'%' + q + '%'} OR LOWER(u.name) LIKE ${'%' + q + '%'}` : sql``}
    ORDER BY u.created_at DESC
    LIMIT ${lim}
  `;
  const rows = await base;
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    country: r.country === 'AO' ? 'AO' : 'BR',
    hasAccess: r.has_access !== false && (!r.access_until || new Date(r.access_until as string).getTime() > Date.now()),
    accessUntil: r.access_until ? new Date(r.access_until as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    lastSyncAt: r.last_sync ? new Date(r.last_sync as string).toISOString() : null,
  }));
}

/** Utilizadores cujo acesso expira nos próximos N dias (renovação proativa). */
export async function adminExpiringSoon(days = 7): Promise<AdminUserRow[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, name, country, has_access, access_until, created_at,
           (SELECT MAX(updated_at) FROM user_state s WHERE s.user_id = users.id) AS last_sync
    FROM users
    WHERE access_until IS NOT NULL
      AND access_until > now()
      AND access_until < now() + (${Math.min(Math.max(days, 1), 90)} || ' days')::interval
    ORDER BY access_until ASC
    LIMIT 50
  `;
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    country: r.country === 'AO' ? 'AO' : 'BR',
    hasAccess: true,
    accessUntil: new Date(r.access_until as string).toISOString(),
    createdAt: new Date(r.created_at as string).toISOString(),
    lastSyncAt: r.last_sync ? new Date(r.last_sync as string).toISOString() : null,
  }));
}

/** Estende o acesso de um usuário em N dias a partir de agora (ou da data atual de expiração, se futura). */
export async function adminExtendAccess(adminEmail: string, userId: string, days: number): Promise<string> {
  await ensureSchema();
  const sql = getSql();
  const safeDays = Math.min(Math.max(Math.floor(Number(days) || 0), -365), 365);
  if (safeDays === 0) throw new Error('Dias deve ser diferente de zero');

  const rows = await sql`SELECT access_until FROM users WHERE id = ${userId} LIMIT 1`;
  if (rows.length === 0) throw new Error('Usuário não encontrado');
  const current = rows[0] as { access_until: string | Date | null };
  const baseMs = current.access_until ? new Date(current.access_until).getTime() : Date.now();
  const from = baseMs > Date.now() ? baseMs : Date.now();
  const newUntil = new Date(from + safeDays * 24 * 60 * 60 * 1000).toISOString();

  await sql`
    UPDATE users
    SET has_access = true, access_until = ${newUntil}
    WHERE id = ${userId}
  `;
  await audit(adminEmail, 'extend_access', { userId, days: safeDays, newUntil });
  return newUntil;
}

/** Revoga o acesso imediatamente (estorno/cobrança indevida). */
export async function adminRevokeAccess(adminEmail: string, userId: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`UPDATE users SET has_access = false, access_until = NULL WHERE id = ${userId}`;
  await audit(adminEmail, 'revoke_access', { userId });
}

/* ─── Auditoria (leitura) ─── */

export interface AdminAuditRow {
  id: number;
  adminEmail: string;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export async function adminRecentActions(limit = 30): Promise<AdminAuditRow[]> {
  await ensureAuditSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, admin_email, action, detail, created_at
    FROM admin_actions ORDER BY id DESC LIMIT ${Math.min(limit, 100)}
  `;
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    adminEmail: String(r.admin_email),
    action: String(r.action),
    detail: (r.detail as Record<string, unknown>) || null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}
