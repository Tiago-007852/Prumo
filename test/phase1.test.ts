/**
 * Testes da Fase 1: Parser OFX + Motor de Recorrências.
 * Estilo consistente com os testes existentes (assert + tsx).
 */

import {
  parseOfx,
  parseOfxDate,
  parseOfxAmount,
  classifyImportedDescription,
} from '../src/services/ofxParser';
import {
  getRuleOccurrences,
  materializeRecurringTransactions,
} from '../src/services/recurrenceEngine';
import { RecurrenceRule, Transaction } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Test Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

/* ── OFX: datas e valores ── */

function runOfxParserTests() {
  console.log('\n--- 🧪 Parser OFX ---\n');

  assert(parseOfxDate('20260815') === '2026-08-15', 'parseOfxDate YYYYMMDD');
  assert(parseOfxDate('20260815120000') === '2026-08-15', 'parseOfxDate com hora');
  assert(parseOfxDate('20260815120000[-3:GMT]') === '2026-08-15', 'parseOfxDate com timezone');
  assert(parseOfxDate('') === null, 'parseOfxDate vazio → null');
  assert(parseOfxDate('20261399') === null, 'parseOfxDate mês/dia inválidos → null');

  assert(parseOfxAmount('-150.00') === -150, 'parseOfxAmount negativo simples');
  assert(parseOfxAmount('1234.56') === 1234.56, 'parseOfxAmount positivo decimal');
  assert(parseOfxAmount('-1.234,56') === -1234.56, 'parseOfxAmount formato pt (1.234,56)');

  // OFX SGML real (estilo Itaú/Nubank): tags sem fechamento
  const sgml = [
    'OFXHEADER:100',
    'DATA:OFXSGML',
    'VERSION:102',
    '',
    '<OFX>',
    '<BANKMSGSRSV1><STMTTRNRS><STMTRS>',
    '<CURDEF>BRL',
    '<BANKACCTFROM><BANKID>0331</BANKID><ACCTID>12345678</ACCTID>',
    '<BANKTRANLIST>',
    '<DTSTART>20260801',
    '<DTEND>20260831',
    '<STMTTRN>',
    '<TRNTYPE>DEBIT',
    '<DTPOSTED>20260815120000',
    '<TRNAMT>-150.00',
    '<FITID>TX001',
    '<NAME>PAGTO CONTA LUZ',
    '</STMTTRN>',
    '<STMTTRN>',
    '<TRNTYPE>CREDIT',
    '<DTPOSTED>20260805100000',
    '<TRNAMT>5000.00',
    '<FITID>TX002',
    '<NAME>PIX RECEBIDO CLIENTE',
    '</STMTTRN>',
    '</BANKTRANLIST>',
    '</STMTRS></STMTTRNRS></BANKMSGSRSV1>',
    '</OFX>',
  ].join('\n');
  const enc = new TextEncoder().encode(sgml);
  const buf = enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength);

  const r1 = parseOfx(buf as ArrayBuffer);
  assert(!('message' in r1), 'OFX SGML válido faz parse sem erro');
  if (!('message' in r1)) {
    assert(r1.transactions.length === 2, `Duas transações extraídas (recebido: ${r1.transactions.length})`);
    assert(r1.transactions[0].type === 'expense', 'TRNAMT negativo → expense');
    assert(r1.transactions[1].type === 'income', 'TRNAMT positivo → income');
    assert(r1.transactions[0].date === '2026-08-15', 'DTPOSTED convertido para YYYY-MM-DD');
    assert(r1.currency === 'BRL', 'CURDEF capturado');
    assert(r1.periodStart === '2026-08-01' && r1.periodEnd === '2026-08-31', 'Período do extrato capturado');
  }

  // Arquivo não-OFX deve retornar erro
  const bad = parseOfx(new TextEncoder().encode('qualquer coisa aleatória').buffer as ArrayBuffer);
  assert('message' in bad, 'Arquivo não-OFX retorna erro amigável');

  // Dedup por FITID
  const dup = sgml.replace('<FITID>TX002', '<FITID>TX001');
  const enc2 = new TextEncoder().encode(dup);
  const r2 = parseOfx(enc2.buffer.slice(enc2.byteOffset, enc2.byteOffset + enc2.byteLength) as ArrayBuffer);
  if (!('message' in r2)) {
    assert(r2.transactions.length === 1, 'Duplicata por FITID removida no parse');
  }

  // Classificador offline de importação
  assert(classifyImportedDescription('UBER TRIP SAO PAULO') === 'Transporte', 'Classificação: Uber → Transporte');
  assert(classifyImportedDescription('IFOOD RESTAURANTE') === 'Alimentação', 'Classificação: iFood → Alimentação');
  assert(classifyImportedDescription('XYZ GENERICO') === 'Outros', 'Classificação: desconhecido → Outros');
}

/* ── Motor de recorrências ── */

function rule(partial: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    id: 'rec_test_1',
    userId: 'user-1',
    description: 'Aluguel',
    amount: 1200,
    type: 'expense',
    category: 'Moradia',
    frequency: 'monthly',
    dayOfMonth: 10,
    startDate: '2026-01-10',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

function tx(id: string, occurredAt: string, tags?: string[]): Transaction {
  return {
    id,
    userId: 'user-1',
    description: 'qualquer',
    amount: 10,
    type: 'expense',
    category: 'Outros',
    source: 'manual',
    occurredAt,
    createdAt: occurredAt,
    tags,
  };
}

function runRecurrenceTests() {
  console.log('\n--- 🧪 Motor de Recorrências ---\n');

  // 1. Mensal: gera do início até hoje, nunca além
  const occ = getRuleOccurrences(rule({}), new Date(2026, 2, 20)); // 20/mar/2026
  assert(occ.length === 3, `Mensal gera jan+fev+mar (recebido: ${occ.length})`);
  assert(occ[0] === '2026-01-10' && occ[2] === '2026-03-10', 'Datas corretas (dia 10)');

  // Dia 31 clampado em meses curtos
  const occ31 = getRuleOccurrences(rule({ dayOfMonth: 31, startDate: '2026-01-31' }), new Date(2026, 3, 5));
  assert(occ31[1] === '2026-02-28', `Dia 31 clampado para 28 em fevereiro (recebido: ${occ31[1]})`);

  // 2. startDate no futuro → nada gerado
  assert(getRuleOccurrences(rule({ startDate: '2030-01-10' }), new Date(2026, 0, 1)).length === 0, 'Regra futura não gera nada');

  // 3. Regra pausada não gera
  assert(getRuleOccurrences(rule({ active: false })).length === 0, 'Regra inativa não gera ocorrências');

  // 4. endDate limita
  const occEnd = getRuleOccurrences(rule({ endDate: '2026-02-28' }), new Date(2026, 5, 1));
  assert(occEnd.length === 2, `endDate corta em fevereiro (recebido: ${occEnd.length})`);

  // 5. Semanal: gera a cada 7 dias
  const occW = getRuleOccurrences(rule({ frequency: 'weekly', dayOfMonth: undefined, startDate: '2026-03-01' }), new Date(2026, 2, 22));
  assert(occW.length === 4 && occW[3] === '2026-03-22', `Semanal gera 1, 8, 15 e 22 (recebido: ${occW.length})`);

  // 6. Materialização: cria transações novas
  const rules = [rule({})];
  const created = materializeRecurringTransactions(rules, [], 'user-1', new Date(2026, 2, 20));
  assert(created.length === 3, `Materializa 3 lançamentos (recebido: ${created.length})`);
  assert(created[0].source === 'recurring', 'source = recurring');
  assert(created[0].tags?.[0] === 'rec:rec_test_1:2026-01-10', 'Tag marcadora rec:<id>:<data>');

  // 7. IDEMPOTÊNCIA: rodar de novo não duplica
  const created2 = materializeRecurringTransactions(rules, [...created], 'user-1', new Date(2026, 2, 20));
  assert(created2.length === 0, `Segunda execução não duplica (recebido: ${created2.length})`);

  // 8. Mês virado: só o novo mês é criado
  const created3 = materializeRecurringTransactions(rules, [...created], 'user-1', new Date(2026, 3, 10));
  assert(created3.length === 1 && created3[0].occurredAt === '2026-04-10', 'Nova ocorrência no mês seguinte é criada');
}

runOfxParserTests();
runRecurrenceTests();

console.log('\n🎉 TODOS OS TESTES DA FASE 1 PASSARAM COM SUCESSO!\n');
