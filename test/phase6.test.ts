/**
 * Testes da Fase 6: login com Google (GIS → tokeninfo → sessão).
 * Cobertos: extração do ID token do callback, formato JWT e client_id plausível.
 */

import {
  extractGoogleIdToken,
  isPlausibleGoogleClientId,
  humanizeGooglePromptIssue,
} from '../src/services/googleAuthRules';

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

const FAKE_JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';

// ─── extractGoogleIdToken ───

assert(extractGoogleIdToken({ credential: FAKE_JWT }) === FAKE_JWT, 'callback GIS com credential válida → token extraído');
assert(extractGoogleIdToken({ credential: 'abc.def.ghi' }) === 'abc.def.ghi', 'JWT mínimo (3 segmentos) aceito');
assert(extractGoogleIdToken({}) === null, 'sem credential → null');
assert(extractGoogleIdToken({ credential: 123 }) === null, 'credential não-string → null');
assert(extractGoogleIdToken({ credential: 'apenas-um-segmento' }) === null, 'sem 3 segmentos → null');
assert(extractGoogleIdToken({ credential: 'a.b' }) === null, '2 segmentos → null');
assert(extractGoogleIdToken({ credential: '.def.ghi' }) === null, 'segmento vazio → null');
assert(extractGoogleIdToken(null) === null, 'response null → null');
assert(extractGoogleIdToken('string solta') === null, 'response não-objeto → null');

// ─── isPlausibleGoogleClientId ───

assert(
  isPlausibleGoogleClientId('63373575481-vfn511gl4nccmif6eu6f4ifp8rorvfk9.apps.googleusercontent.com'),
  'client_id real do projeto → plausível'
);
assert(isPlausibleGoogleClientId('123-abc.apps.googleusercontent.com'), 'client_id genérico → plausível');
assert(!isPlausibleGoogleClientId('GOCSPX-muito-secreto'), 'client secret NÃO é client_id');
assert(!isPlausibleGoogleClientId('https://accounts.google.com'), 'URL não é client_id');
assert(!isPlausibleGoogleClientId(''), 'vazio → não plausível');
assert(!isPlausibleGoogleClientId(null), 'null → não plausível');
assert(!isPlausibleGoogleClientId(undefined), 'undefined → não plausível');

// ─── humanizeGooglePromptIssue (diagnóstico do One Tap) ───

assert(humanizeGooglePromptIssue('dismissed', 'qualquer', false).silent === true, 'prompt fechado → silencioso');
assert(
  humanizeGooglePromptIssue('skipped', 'user_cancel', false).silent === true,
  'skip por user_cancel → silencioso'
);
assert(
  humanizeGooglePromptIssue('not_displayed', 'third_party_cookies_blocked', false).message?.includes(
    'cookies'
  ) === true,
  'cookies de 3º bloqueados → mensagem fala de cookies'
);
assert(
  humanizeGooglePromptIssue('not_displayed', 'third_party_cookies_blocked', true).message?.includes(
    'incorporada'
  ) === true,
  'em iframe → mensagem menciona janela incorporada'
);
assert(
  humanizeGooglePromptIssue('not_displayed', 'opt_out_or_no_session', false).message?.includes(
    'sessão Google'
  ) === true,
  'sem sessão Google → mensagem orienta'
);
assert(
  humanizeGooglePromptIssue('not_displayed', 'motivo_desconhecido', false).message !== null,
  'motivo desconhecido → mensagem genérica útil'
);

// ─── Resumo ───

console.log(`\n📊 Fase 6: ${passed} asserts passando, ${failed} falhando`);
if (failed > 0) process.exit(1);
