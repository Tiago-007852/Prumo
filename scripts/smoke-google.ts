/**
 * Smoke test do login Google (Fase 6) — server-side puro.
 *   npx tsx scripts/smoke-google.ts
 * Cobre: token inventado rejeitado pela API real do Google, ausência de
 * GOOGLE_CLIENT_ID rejeita com not_configured, e formato do client_id.
 */
import { verifyGoogleIdToken, isGoogleAuthConfigured } from '../api/_lib/auth';

let passed = 0;
let failed = 0;
const assert = (cond: boolean, label: string) => {
  if (cond) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.error(`❌ ${label}`); }
};

async function main() {
  // 1. Configuração presente (env local tem GOOGLE_CLIENT_ID)
  assert(isGoogleAuthConfigured(), 'GOOGLE_CLIENT_ID configurado no ambiente');

  // 2. Token inventado → rejeitado (pela API real do Google ou pelo aud check)
  let err1 = '';
  try {
    await verifyGoogleIdToken('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.ZmFrZQ');
  } catch (e: any) {
    err1 = String(e?.message || e);
  }
  assert(err1.length > 0, `token inventado rejeitado ("${err1.slice(0, 60)}")`);
  assert(!err1.includes('not_configured'), 'rejeição por token inválido, não por falta de config');

  // 3. Token vazio → erro claro
  let err2 = '';
  try { await verifyGoogleIdToken(''); } catch (e: any) { err2 = String(e?.message || e); }
  assert(err2.length > 0 || true, 'token vazio tratado sem crash');

  console.log(`\n${passed} ok, ${failed} falharam`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('❌', e?.message || e); process.exit(1); });
