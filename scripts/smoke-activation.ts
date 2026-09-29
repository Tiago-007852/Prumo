/**
 * Smoke test E2E do ciclo de códigos de ativação (Fase 5) contra o Neon real.
 * Não faz parte da suite `bun run test` (precisa de DATABASE_URL) — correr
 * manualmente:  npx tsx scripts/smoke-activation.ts
 *
 * Cobre: formato/normalização, ativação single-use, bloqueio da 2ª utilização,
 * código inexistente e ACCESS_CODE do env (fallback), com limpeza completa.
 */
import { neon } from '@neondatabase/serverless';
import { randomInt } from 'crypto';
import { registerUser } from '../api/_lib/auth';
import { activateWithCode } from '../api/_lib/payments';
import { normalizeActivationCode, isValidActivationCodeFormat } from '../src/services/accessRules';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join('');
const tempCode = `PRUMO-${block()}-${block()}-${block()}`;

let passed = 0;
let failed = 0;
const assert = (cond: boolean, label: string) => {
  if (cond) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.error(`❌ ${label}`); }
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ausente');
  const sql = neon(process.env.DATABASE_URL);

  // Inserir código temporário de teste
  await sql`INSERT INTO activation_codes (code, days, note) VALUES (${tempCode}, 31, 'SMOKE-TEST')`;
  assert(isValidActivationCodeFormat(tempCode), `formato válido: ${tempCode}`);
  assert(isValidActivationCodeFormat('prumo abcd efgh jkmn'), 'normalização: minúsculas + espaços');
  assert(!isValidActivationCodeFormat('PRUMO-IOLO-0000-1111'), 'caracteres ambíguos rejeitados');

  // Usuário temporário
  const email = `smoke$(Date.now())`.replace('$(Date.now())', String(Date.now())) + '@prumo.dev';
  const { user } = await registerUser({ email, password: 'senha12345', name: 'Smoke Activation', country: 'AO' });

  // 1ª ativação — sucesso
  const until1 = await activateWithCode(user.id, tempCode.toLowerCase()); // minúsculas de propósito
  assert(new Date(until1).getTime() > Date.now() + 30 * 24 * 3600 * 1000, '1ª ativação concedeu +31 dias (entrada em minúsculas normalizada)');

  // 2ª ativação — bloqueada
  let secondError = '';
  try { await activateWithCode(user.id, tempCode); } catch (e: any) { secondError = String(e?.message || e); }
  assert(secondError.includes('já foi utilizado'), `2ª utilização bloqueada ("${secondError}")`);

  // Código inexistente com formato válido → fallback → ACCESS_CODE do env
  const envCode = process.env.ACCESS_CODE;
  if (envCode) {
    const until3 = await activateWithCode(user.id, ` ${envCode} `);
    assert(new Date(until3).getTime() > Date.now(), 'fallback ACCESS_CODE (env) funciona');
  }
  let badError = '';
  try { await activateWithCode(user.id, 'PRUMO-ZZZZ-ZZZZ-ZZZZ'); } catch (e: any) { badError = String(e?.message || e); }
  assert(badError.includes('inválido') || badError.includes('indisponível'), 'código inexistente rejeitado');

  // Estado na tabela
  const rows = await sql`SELECT status, used_by FROM activation_codes WHERE code = ${normalizeActivationCode(tempCode)}`;
  assert(rows[0]?.status === 'usado' && rows[0]?.used_by === user.id, 'código marcado como usado com o utilizador certo');

  // Cleanup total
  await sql`DELETE FROM users WHERE id = ${user.id}`;
  await sql`DELETE FROM activation_codes WHERE code = ${tempCode}`;
  console.log(`\n🧹 limpo (usuário + código temporário). ${passed} ok, ${failed} falharam`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('❌', e?.message || e); process.exit(1); });
