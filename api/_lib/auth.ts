/**
 * Autenticação do Prumo — armazenada no próprio Neon (users + sessions).
 * Senha com bcrypt; sessão em cookie httpOnly com token aleatório de 256 bits.
 * Compartilhada entre server.ts (Express) e as funções serverless (api/).
 */
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { getSql, ensureSchema } from './db';
import { ensurePaymentsSchema } from './payments';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  country: 'BR' | 'AO';
}

const SESSION_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 10;

export const SESSION_COOKIE = 'prumo_session';

function newToken(): string {
  return randomBytes(32).toString('hex');
}

function expiryDate(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface AuthResult {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}

/** Cria a conta (email/senha) e já devolve a sessão ativa. */
export async function registerUser(input: {
  email: unknown;
  password: unknown;
  name?: unknown;
  country?: unknown;
}): Promise<AuthResult> {
  await ensureSchema();
  await ensurePaymentsSchema(); // colunas de acesso existem antes do insert
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');

  if (!isValidEmail(email)) throw new Error('Email inválido');
  if (password.length < 8) throw new Error('A senha precisa ter ao menos 8 caracteres');

  const name = String(input.name || '').trim() || email.split('@')[0];
  const country = input.country === 'AO' ? 'AO' : 'BR';

  const sql = getSql();
  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    throw new Error('Este email já está cadastrado');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = `usr_${randomBytes(8).toString('hex')}`;

  // Contas novas nascem SEM acesso (paywall Fase 5). Usuários anteriores
  // ficam grandfathered pelo DEFAULT true da migração em ensurePaymentsSchema.
  const rows = await sql`
    INSERT INTO users (id, email, password_hash, name, country, has_access)
    VALUES (${id}, ${email}, ${passwordHash}, ${name}, ${country}, false)
    RETURNING id, email, name, country
  `;
  const user = rows[0] as unknown as AuthUser;

  const token = newToken();
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${user.id}, ${expiryDate().toISOString()})
  `;
  return { user, token, expiresAt: expiryDate() };
}

/** Autentica com email/senha e cria a sessão. */
export async function loginUser(input: {
  email: unknown;
  password: unknown;
}): Promise<AuthResult> {
  await ensureSchema();
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');

  if (!email || !password) throw new Error('Informe email e senha');

  const sql = getSql();
  const rows = await sql`
    SELECT id, email, name, country, password_hash
    FROM users WHERE email = ${email} LIMIT 1
  `;
  if (rows.length === 0) {
    throw new Error('Email ou senha incorretos');
  }

  const row = rows[0] as { id: string; email: string; name: string; country: string; password_hash: string };
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    throw new Error('Email ou senha incorretos');
  }

  const user: AuthUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    country: row.country === 'AO' ? 'AO' : 'BR',
  };

  const token = newToken();
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${user.id}, ${expiryDate().toISOString()})
  `;
  return { user, token, expiresAt: expiryDate() };
}

/** Valida o token da sessão e devolve o usuário (ou null se inválido/expirado). */
export async function getUserByToken(token: string | null | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.country
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as { id: string; email: string; name: string; country: string };
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    country: row.country === 'AO' ? 'AO' : 'BR',
  };
}

/** Encerra a sessão atual. */
export async function destroySession(token: string | null | undefined): Promise<void> {
  if (!token) return;
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

/* ─── Login com Google (Fase 5/6) ───
 * Google Identity Services: o cliente entrega um ID token (JWT) assinado
 * pelo Google; validamos no endpoint oficial tokeninfo (aud == GOOGLE_CLIENT_ID
 * e email_verified) e criamos/reaproveitamos o usuário + sessão padrão.
 * Migração: coluna google_sub em users (idempotente, cacheada).
 */

let _googleSchemaReady: Promise<void> | null = null;

export function ensureGoogleSchema(): Promise<void> {
  if (!_googleSchemaReady) {
    _googleSchemaReady = (async () => {
      const sql = getSql();
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT`;
    })().catch((err) => {
      _googleSchemaReady = null;
      throw err;
    });
  }
  return _googleSchemaReady;
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

export interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  aud: string;
}

/** Valida um ID token do Google no endpoint oficial (aud + email_verified). */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw Object.assign(new Error('Login com Google não configurado no servidor'), { code: 'not_configured' });
  }
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) {
    throw new Error('Token do Google inválido ou expirado');
  }
  const info = (await res.json()) as GoogleTokenInfo;
  if (info.aud !== clientId) {
    throw new Error('Token do Google emitido para outro app');
  }
  const verified = info.email_verified === true || info.email_verified === 'true';
  if (!info.email || !verified) {
    throw new Error('Email do Google não verificado');
  }
  return info;
}

/**
 * Entrar/registar com Google: procura por google_sub, depois por email
 * (vincula a conta email/senha existente), ou cria conta nova.
 */
export async function googleLoginUser(input: {
  idToken: unknown;
}): Promise<AuthResult> {
  await ensureSchema();
  await ensureGoogleSchema();
  const idToken = String(input.idToken || '').trim();
  if (!idToken) throw new Error('Token do Google ausente');

  const info = await verifyGoogleIdToken(idToken);
  const email = normalizeEmail(info.email);
  const name = String(info.name || '').trim() || email.split('@')[0];
  const sql = getSql();

  // 1. Já entrou com Google antes (google_sub conhecido)
  let rows = await sql`SELECT id, email, name, country FROM users WHERE google_sub = ${info.sub} LIMIT 1`;
  let user: AuthUser | null = rows.length > 0 ? toAuthUser(rows[0] as Record<string, unknown>) : null;

  // 2. Conta email/senha existente com o mesmo email → vincula
  if (!user) {
    rows = await sql`SELECT id, email, name, country FROM users WHERE email = ${email} LIMIT 1`;
    if (rows.length > 0) {
      user = toAuthUser(rows[0] as Record<string, unknown>);
      await sql`UPDATE users SET google_sub = ${info.sub} WHERE id = ${user.id}`;
    }
  }

  // 3. Conta nova (nasce SEM acesso — paywall igual ao registro por senha)
  if (!user) {
    const id = `usr_${randomBytes(8).toString('hex')}`;
    // País por domínio do email é frágil; BR é o padrão do schema.
    rows = await sql`
      INSERT INTO users (id, email, password_hash, name, country, has_access, google_sub)
      VALUES (${id}, ${email}, ${'google:' + randomBytes(12).toString('hex')}, ${name}, 'BR', false, ${info.sub})
      RETURNING id, email, name, country
    `;
    user = toAuthUser(rows[0] as Record<string, unknown>);
  }

  const token = newToken();
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${user.id}, ${expiryDate().toISOString()})
  `;
  return { user, token, expiresAt: expiryDate() };
}

function toAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    country: row.country === 'AO' ? 'AO' : 'BR',
  };
}
