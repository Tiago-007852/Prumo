/**
 * Gere códigos de ativação single-use (PRUMO-XXXX-XXXX-XXXX) no Neon.
 *
 * Uso:
 *   node scripts/generate-codes.mjs --generate --count 20 --note "Revendedor X"
 *   node scripts/generate-codes.mjs --list [--limit 50]
 *
 * Requer DATABASE_URL no ambiente. Alfabeto sem caracteres ambíguos (I/L/O/0/1).
 */
import { neon } from '@neondatabase/serverless';
import { randomInt } from 'crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem I/L/O/0/1

function generateCode() {
  const block = (n) =>
    Array.from({ length: n }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join('');
  return `PRUMO-${block(4)}-${block(4)}-${block(4)}`;
}

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ DATABASE_URL ausente no ambiente');
  process.exit(1);
}
const sql = neon(url);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS activation_codes (
      code       TEXT PRIMARY KEY,
      days       INTEGER NOT NULL DEFAULT 31,
      note       TEXT,
      status     TEXT NOT NULL DEFAULT 'novo',
      used_by    TEXT,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function generate() {
  await ensureTable();
  const count = Math.min(Math.max(parseInt(opt('--count', '10'), 10) || 10, 1), 200);
  const days = Math.min(Math.max(parseInt(opt('--days', '31'), 10) || 31, 1), 365);
  const note = opt('--note', '') || null;

  const inserted = [];
  let attempts = 0;
  while (inserted.length < count && attempts < count * 5) {
    attempts++;
    const batch = Array.from({ length: Math.min(count - inserted.length, 20) }, generateCode);
    for (const code of batch) {
      const res = await sql`
        INSERT INTO activation_codes (code, days, note)
        VALUES (${code}, ${days}, ${note})
        ON CONFLICT (code) DO NOTHING
        RETURNING code
      `;
      if (res.length > 0) inserted.push(code);
    }
  }

  console.log(`✅ ${inserted.length} código(s) gerado(s) (validade: ${days} dias${note ? ` · nota: ${note}` : ''}):\n`);
  for (const c of inserted) console.log(`   ${c}`);
  console.log('\n↳ Envia um código por cliente. Após usado, morre (utilização única).');
}

async function list() {
  await ensureTable();
  const limit = Math.min(parseInt(opt('--limit', '50'), 10) || 50, 500);
  const rows = await sql`
    SELECT code, days, note, status, used_by, used_at, created_at
    FROM activation_codes ORDER BY created_at DESC LIMIT ${limit}
  `;
  if (rows.length === 0) {
    console.log('Nenhum código na base de dados. Gera com --generate.');
    return;
  }
  console.log(`Códigos (últimos ${rows.length}):\n`);
  for (const r of rows) {
    const status = r.status === 'novo' ? '🟢 novo' : `🔴 usado por ${r.used_by || '?'} em ${r.used_at ? new Date(r.used_at).toISOString().slice(0, 10) : '?'}`;
    console.log(`   ${r.code}  ${String(r.days).padStart(3)}d  ${status}${r.note ? `  [${r.note}]` : ''}`);
  }
}

if (has('--generate')) {
  await generate();
} else if (has('--list')) {
  await list();
} else {
  console.log('Uso:\n  node scripts/generate-codes.mjs --generate --count 20 --note "Revendedor X" [--days 31]\n  node scripts/generate-codes.mjs --list [--limit 50]');
}
