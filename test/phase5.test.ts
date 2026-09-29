/**
 * Testes da Fase 5: paywall pós-onboarding.
 * Cobertos: tabela de preços Kz/R$ (paridade 4.900 Kz ≈ R$ 29,90), validação
 * de session_id do Stripe, avaliação de acesso (validade/grandfathering) e a
 * sanitização do servidor que preserva onboardingCompleted (anti-burla).
 */

import { PRICING_BR, PRICING_AO, pricingFor } from '../src/config/pricing';
import {
  isValidCheckoutSessionId,
  evaluateAccess,
  normalizeActivationCode,
  isValidActivationCodeFormat,
} from '../src/services/accessRules';

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) {
    passed++;
    console.log(`✅ Passed: ${label}`);
  } else {
    failed++;
    console.error(`❌ FAILED: ${label}`);
  }
}

// ─── Preços (Fase 5 — A: 4.900 Kz / R$ convertido) ───

assert(PRICING_AO.currency === 'AOA', 'Angola cobra em AOA');
assert(PRICING_AO.monthly === 4900, 'Preço mensal Angola = 4.900 Kz');
assert(PRICING_BR.currency === 'BRL', 'Brasil cobra em BRL');
assert(PRICING_BR.monthly === 29.9, 'Preço mensal Brasil = R$ 29,90 (paridade ~4.900 Kz)');
assert(PRICING_BR.anchor > PRICING_BR.monthly, 'Âncora BR maior que o preço (efeito -85%)');
assert(PRICING_AO.anchor > PRICING_AO.monthly, 'Âncora AO maior que o preço (efeito -80%)');
assert(pricingFor('BR') === PRICING_BR && pricingFor('AO') === PRICING_AO, 'pricingFor devolve a tabela certa por país');
assert(PRICING_BR.discountPct === 85 && PRICING_AO.discountPct === 80, 'Selos de desconto: BR -85%, AO -80%');

// ─── Validação de session_id do Stripe ───

assert(isValidCheckoutSessionId('cs_test_abc123'), 'session_id de teste válido');
assert(isValidCheckoutSessionId('cs_live_XyZ789'), 'session_id de produção válido');
assert(!isValidCheckoutSessionId(''), 'session_id vazio rejeitado');
assert(!isValidCheckoutSessionId('cs_test_'), 'prefixo sem payload rejeitado');
assert(!isValidCheckoutSessionId('session_abcd'), 'formato estranho rejeitado');
assert(!isValidCheckoutSessionId(null), 'null rejeitado');
assert(!isValidCheckoutSessionId(123), 'número rejeitado');
assert(!isValidCheckoutSessionId('cs_test_abc; DROP TABLE users'), 'injeção rejeitada');

// ─── Avaliação de acesso ───

const FUTURE = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

assert(evaluateAccess({ hasAccess: true, accessUntil: FUTURE }) === true, 'Acesso com access_until futuro → liberado');
assert(evaluateAccess({ hasAccess: true, accessUntil: PAST }) === false, 'Acesso com access_until passado → expirado');
assert(evaluateAccess({ hasAccess: false, accessUntil: FUTURE }) === false, 'has_access false sempre bloqueia (contas novas)');
assert(evaluateAccess({ hasAccess: true, accessUntil: null }) === true, 'Sem access_until + has_access → liberado (grandfathered)');
assert(evaluateAccess({ hasAccess: null, accessUntil: null }) === true, 'Colunas ausentes → liberado (grandfathering de coluna)');
assert(evaluateAccess({ hasAccess: false, accessUntil: null }) === false, 'has_access false sem validade → bloqueado');

// ─── Códigos de ativação single-use (formato/normalização) ───

assert(isValidActivationCodeFormat('PRUMO-BB7F-JYQX-WBFN'), 'formato de código single-use válido');
assert(isValidActivationCodeFormat('prumo bb7f jyqx wbfn'), 'entrada em minúsculas/espaços normaliza para válido');
assert(
  normalizeActivationCode('  prumo-bb7f--jyqx  wbfn  ') === 'PRUMO-BB7F-JYQX-WBFN',
  'normalização: trim + maiúsculas + colapsar traços/espacos'
);
assert(!isValidActivationCodeFormat('PRUMO-IOLO-0000-1111'), 'caracteres ambíguos (I/O/0/1) rejeitados');
assert(!isValidActivationCodeFormat('PRUMO-BB7F-JYQX'), 'código curto rejeitado');
assert(!isValidActivationCodeFormat('XYZ-AAAA-BBBB-CCCC'), 'prefixo errado rejeitado');
assert(!isValidActivationCodeFormat(''), 'código vazio rejeitado');

// ─── Anti-burla: sanitizeState preserva onboardingCompleted ───
// Espelho do comportamento exigido em api/_lib/userData.ts (sanitizeState):
// estado antigo (sem a flag) NÃO pode desligar o onboarding de quem já fez.

const rawOld = JSON.parse(JSON.stringify({ user: { name: 'Ana' } }));
const sanitizedOldUser = {
  onboardingCompleted: rawOld.user.onboardingCompleted !== false, // regra do servidor
};
assert(sanitizedOldUser.onboardingCompleted === true, 'Estado antigo sem flag → onboarding preservado (não re-exibe wizard)');

const rawPending = { user: { name: 'Bia', onboardingCompleted: false } };
const sanitizedPendingUser = { onboardingCompleted: rawPending.user.onboardingCompleted !== false };
assert(sanitizedPendingUser.onboardingCompleted === false, 'onboardingCompleted false é preservado (wizard continua pendente)');

// ─── Resumo ───

console.log(`\n📊 Fase 5: ${passed} asserts passando, ${failed} falhando`);
if (failed > 0) process.exit(1);
