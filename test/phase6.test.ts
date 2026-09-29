/**
 * Testes da Fase 6: login com Google (GIS → tokeninfo → sessão).
 * Cobertos: extração do ID token do callback, formato JWT e client_id plausível.
 */

import { extractGoogleIdToken, isPlausibleGoogleClientId } from '../src/services/googleAuthRules';

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

// ─── Resumo ───

console.log(`\n📊 Fase 6: ${passed} asserts passando, ${failed} falhando`);
if (failed > 0) process.exit(1);
