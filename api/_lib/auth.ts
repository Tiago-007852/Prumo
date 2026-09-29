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
