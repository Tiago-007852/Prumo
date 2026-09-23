/**
 * Cliente Neon Postgres (serverless) + inicialização do schema.
 * Usado por server.ts (Express) e pelas funções serverless (api/).
 */
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL não configurada');
    }
    _sql = neon(url);
  }
  return _sql;
}

let _schemaReady: Promise<void> | null = null;

/**
 * Cria as tabelas se não existirem (idempotente, cacheado por instância).
 * Tabelas: users, sessions e user_state (estado consolidado offline-first).
 */
export function ensureSchema(): Promise<void> {
  if (!_schemaReady) {
    _schemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id            TEXT PRIMARY KEY,
          email         TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          name          TEXT NOT NULL,
          country       TEXT NOT NULL DEFAULT 'BR',
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          token      TEXT PRIMARY KEY,
          user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at TIMESTAMPTZ NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS user_state (
          user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          country    TEXT NOT NULL DEFAULT 'BR',
          state      JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`;
    })().catch((err) => {
      _schemaReady = null; // permitir retry na próxima requisição
      throw err;
    });
  }
  return _schemaReady;
}
