/**
 * Remove os utilizadores de teste criados durante o smoke test E2E do paywall
 * (registos com email @prumo.dev). Apaga users + sessions (cascade).
 * Uso: node scripts/cleanup-test-users.mjs
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL ausente');
  process.exit(1);
}
const sql = neon(url);

const rows = await sql`SELECT id, email, name FROM users WHERE email LIKE ${'%@prumo.dev'}`;
if (rows.length === 0) {
  console.log('Nenhum utilizador de teste @prumo.dev encontrado — nada a fazer.');
  process.exit(0);
}
for (const r of rows) {
  await sql`DELETE FROM users WHERE id = ${r.id}`;
  console.log(`🧹 removido: ${r.email} (${r.name})`);
}
console.log(`Total: ${rows.length} utilizador(es) de teste eliminado(s).`);
