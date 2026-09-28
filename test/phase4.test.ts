/**
 * Testes da Fase 4: multi-moeda (conversão de câmbio), mapeamentos do Open
 * Finance (Pluggy → modelos do Prumo) e helpers do cache de taxas.
 */

import {
  convertAmount,
  formatMoney,
  isCacheFresh,
  FALLBACK_RATES,
  ExchangeRates,
} from '../src/services/exchangeRateService';
import {
  mapPluggyAccount,
  mapPluggyTransaction,
  PluggyAccount,
  PluggyTransaction,
} from '../src/services/pluggyMapping';

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

// Taxas sintéticas: 1 USD = 5 BRL = 1000 AOA → 1 BRL = 200 AOA
const RATES: ExchangeRates = {
  base: 'USD',
  rates: { USD: 1, BRL: 5, AOA: 1000 },
  updatedAt: Date.now(),
  fallback: false,
};

// ─── convertAmount ───

assert(convertAmount(100, 'BRL', 'BRL', RATES) === 100, 'Mesma moeda → sem conversão');
assert(convertAmount(10, 'USD', 'BRL', RATES) === 50, 'USD→BRL (10 × 5 = 50)');
assert(convertAmount(1000, 'AOA', 'USD', RATES) === 1, 'AOA→USD (1000/1000 = 1)');
assert(convertAmount(200, 'AOA', 'BRL', RATES) === 1, 'AOA→BRL via USD (200/1000×5)');
assert(convertAmount(1, 'BRL', 'AOA', RATES) === 200, 'BRL→AOA via USD (1/5×1000)');
assert(
  convertAmount(10.555, 'USD', 'BRL', RATES) === 52.78,
  'Arredondamento a 2 casas (10.555×5 = 52.775 → 52.78)'
);
assert(
  convertAmount(100, 'BRL', 'USD', { ...RATES, rates: { USD: 1, BRL: 0, AOA: 1000 } }) === 100,
  'Taxa zero → devolve original (proteção contra divisão por zero)'
);

// ─── FALLBACK_RATES e isCacheFresh ───

assert(FALLBACK_RATES.fallback === true, 'Fallback marcado como fallback');
assert(FALLBACK_RATES.rates.BRL > 0 && FALLBACK_RATES.rates.AOA > 0, 'Fallback tem taxas positivas');
assert(isCacheFresh(null) === false, 'Cache nulo não é fresco');
assert(isCacheFresh({ ...RATES, updatedAt: Date.now() - 1000 }) === true, 'Cache de 1s atrás é fresco');
assert(
  isCacheFresh({ ...RATES, updatedAt: Date.now() - 13 * 60 * 60 * 1000 }) === false,
  'Cache de 13h não é fresco (TTL 12h)'
);

// ─── formatMoney ───

assert(formatMoney(1234.5, 'BRL').includes('1.234,50'), 'BRL formata pt-BR com 2 casas');
// Separador de milhar pode ser espaço normal, NBSP (U+00A0) ou NNBSP (U+202F)
assert(
  formatMoney(1234, 'AOA').replace(/[\s\u00A0\u202F]/g, '').includes('1234') && formatMoney(1234, 'AOA').includes('Kz'),
  'AOA formata sem casas decimais (milhar separado)'
);
assert(formatMoney(9.99, 'USD').includes('9,99'), 'USD formata com decimais (vírgula pt-AO)');

// ─── mapPluggyAccount ───

const item = { id: 'item_1', institution: { name: 'Banco Teste' } };
const mapped = mapPluggyAccount(
  {
    id: 'acc-abc-123',
    subtype: 'CHECKING_ACCOUNT',
    balance: 1500.75,
    accountNumber: '987654321',
  },
  item,
  'usr_1',
  'BRL'
);
assert(mapped.provider === 'open_finance', 'Conta Pluggy vira provider open_finance');
assert(mapped.institutionName === 'Banco Teste', 'Nome da instituição vem do item');
assert(mapped.kind === 'checking', 'Subtipo CHECKING_ACCOUNT → checking');
assert(mapped.balance === 1500.75, 'Saldo preservado');
assert(mapped.currency === 'BRL', 'Moeda local do país aplicada');
assert(mapped.accountNumberMask === '•••• 4321', 'Máscara de conta com 4 últimos dígitos');
assert(mapped.id.startsWith('acc_of_'), 'ID determinístico com prefixo acc_of_');
assert(mapped.status === 'connected', 'Status inicial connected');

const mappedSavings = mapPluggyAccount(
  { id: 'x', subtype: 'CREDIT_CARD', balance: -320 },
  item,
  'usr_1',
  'AOA'
);
assert(mappedSavings.kind === 'credit', 'Subtipo CREDIT_CARD → credit');
assert(mappedSavings.currency === 'AOA', 'Moeda AOA para usuário angolano');
assert(mappedSavings.balance === -320, 'Saldo negativo (cartão) preservado');

const mappedUnknown = mapPluggyAccount({ id: 'y', balance: 10 }, { id: 'i' }, 'usr_1', 'BRL');
assert(mappedUnknown.kind === 'checking', 'Subtipo desconhecido → checking');
assert(mappedUnknown.institutionName === 'Instituição Open Finance', 'Instituição ausente → fallback');

// ─── mapPluggyTransaction ───

const txBase: PluggyTransaction = {
  id: 't1',
  description: 'Uber · Viagem',
  amount: 24.9,
  valueDate: '2026-09-20',
  type: 'DEBIT',
  category: 'Transporte',
  merchantName: 'Uber',
};
const mt = mapPluggyTransaction(txBase, 'acc_1', 'usr_1');
assert(mt.type === 'expense', 'DEBIT → expense');
assert(mt.amount === 24.9, 'Valor absoluto preservado');
assert(mt.occurredAt === '2026-09-20', 'Data (valueDate) preservada YYYY-MM-DD');
assert(mt.source === 'auto_import', 'source auto_import');
assert(mt.category === 'Transporte', 'Categoria Pluggy preservada');
assert(mt.merchant === 'Uber', 'Merchant preservado');
assert(mt.accountId === 'acc_1', 'AccountId vinculado');

const mtCredit = mapPluggyTransaction({ ...txBase, type: 'CREDIT', amount: 5000 }, null, 'usr_2');
assert(mtCredit.type === 'income', 'CREDIT → income');
assert(mtCredit.accountId === null, 'Sem conta → accountId nulo');

const mtBad = mapPluggyTransaction({ id: 't3', amount: NaN, type: 'DEBIT' }, null, 'usr_1');
assert(mtBad.amount === 0, 'Amount NaN → 0 (defensivo)');
assert(mtBad.category === 'Outros', 'Categoria ausente → Outros');

const mtNoDate = mapPluggyTransaction({ id: 't4', amount: 1, type: 'DEBIT' }, null, 'usr_1');
assert(/^\d{4}-\d{2}-\d{2}$/.test(mtNoDate.occurredAt), 'Data ausente → hoje em YYYY-MM-DD');

// ─── Resumo ───

console.log(`\n📊 Fase 4: ${passed} asserts passando, ${failed} falhando`);
if (failed > 0) {
  process.exit(1);
}
