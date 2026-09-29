/**
 * Smoke test E2E do painel admin (Fase A) contra o Neon real.
 * Não faz parte da suite automática — correr manualmente:
 *   ADMIN_EMAILS=admin@test.dev npx tsx scripts/smoke-admin.ts
 *
 * Cobre: requireAdmin (403 para não-admin), KPIs, geração de códigos,
 * busca de usuários, estender/revogar acesso e auditoria — com cleanup.
 */
import { neon } from '@neondatabase/serverless';
import { registerUser } from '../api/_lib/auth';
import {
  isAdminEmail,
  requireAdmin,
  getAdminKpis,
  adminGenerateCodes,
  adminListCodes,
  adminSearchUsers,
  adminExtendAccess,
  adminRevokeAccess,
  adminRecentActions,
} from '../api/_lib/admin';

let passed = 0;
let failed = 0;
const assert = (cond: boolean, label: string) => {
  if (cond) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.error(`❌ ${label}`); }
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ausente');
  const adminEmail = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim().toLowerCase();
  if (!adminEmail) throw new Error('Correr com ADMIN_EMAILS=<email> definido');
  const sql = neon(process.env.DATABASE_URL);

  // Usuário comum (não-admin)
  const { user: common } = await registerUser({
    email: `common${Date.now()}@prumo.dev`,
    password: 'senha12345',
    name: 'Common User',
    country: 'AO',
  });

  // 1. 403 para não-admin
  let denied = '';
  try { requireAdmin(common); } catch (e: any) { denied = String(e?.message || e); }
  assert(denied.includes('restrito'), `não-admin bloqueado ("${denied}")`);

  // 2. Admin (1º email de ADMIN_EMAILS)
  const admin = { id: 'admin_test', email: adminEmail, name: 'Admin', country: 'BR' as const, isAdmin: true };
  requireAdmin(admin);
  assert(true, 'admin na lista passa no requireAdmin');

  // 3. KPIs (estrutura)
  const kpis = await getAdminKpis();
  assert(
    typeof kpis.usersTotal === 'number' && typeof kpis.mrrEstimateBrl === 'number',
    `KPIs ok (total=${kpis.usersTotal}, mrr=${kpis.mrrEstimateBrl})`
  );

  // 4. Geração de códigos
  const codes = await adminGenerateCodes(adminEmail, 3, 31, 'SMOKE-ADMIN');
  assert(codes.length === 3, `gerou 3 códigos (${codes[0]}…)`);
  const list = await adminListCodes(10);
  assert(list.some((c) => codes.includes(c.code)), 'códigos aparecem na listagem');

  // 5. Busca de usuários encontra o comum
  await new Promise((r) => setTimeout(r, 300));
  const found = await adminSearchUsers(common.email.slice(0, 12), 10);
  assert(found.some((u) => u.id === common.id), 'busca encontra usuário comum');

  // 6. Estender + revogar
  const until1 = await adminExtendAccess(adminEmail, common.id, 7);
  assert(new Date(until1).getTime() > Date.now(), `acesso estendido (+7d → ${until1.slice(0, 10)})`);
  await adminRevokeAccess(adminEmail, common.id);
  const after = await adminSearchUsers(common.email.slice(0, 12), 5);
  assert(after.find((u) => u.id === common.id)?.hasAccess === false, 'revogar deixa sem acesso');

  // 7. Auditoria registou
  const audit = await adminRecentActions(10);
  assert(audit.some((a) => a.action === 'extend_access'), 'auditoria registou extend_access');
  assert(audit.some((a) => a.action === 'codes_generate'), 'auditoria registou codes_generate');

  // Cleanup: usuário comum + códigos do smoke
  await sql`DELETE FROM users WHERE id = ${common.id}`;
  for (const c of codes) await sql`DELETE FROM activation_codes WHERE code = ${c}`;
  console.log(`\n🧹 cleanup ok. ${passed} ok, ${failed} falharam`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('❌', e?.message || e); process.exit(1); });
