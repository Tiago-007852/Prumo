/**
 * Motor de lançamentos recorrentes do Prumo.
 *
 * Gera transações reais a partir de regras (aluguel, salário, assinaturas) de
 * forma IDEMPOTENTE: cada ocorrência é marcada com a tag `rec:<ruleId>:<YYYY-MM>`,
 * assim rodar o motor N vezes nunca duplica lançamentos.
 *
 * Regras de negócio:
 * - Frequência 'monthly' usa dayOfMonth (clampado ao último dia do mês);
 *   'weekly' repete a cada 7 dias a partir de startDate; 'yearly' 1x por ano.
 * - A regra materializa até o mês corrente — nunca gera lançamentos no futuro
 *   (o dashboard não deve mostrar despesas que ainda não aconteceram).
 * - Regra inativa (active=false) não gera nada; regra com endDate para nele.
 */

import { RecurrenceRule, Transaction } from '../types';

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Chave 'YYYY-MM' de uma data local. */
function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Último dia do mês (local). */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Datas (YYYY-MM-DD) de todas as ocorrências da regra, de startDate até o fim
 * do mês corrente (inclusive), respeitando endDate quando presente.
 */
export function getRuleOccurrences(rule: RecurrenceRule, today = new Date()): string[] {
  if (!rule.active) return [];

  const start = new Date(`${rule.startDate}T00:00:00`);
  if (isNaN(start.getTime())) return [];

  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endCap = rule.endDate ? new Date(`${rule.endDate}T00:00:00`) : null;
  const hardEnd = endCap && !isNaN(endCap.getTime()) && endCap < todayMid ? endCap : todayMid;

  if (start > todayMid) return []; // começa no futuro: nada a materializar

  const out: string[] = [];

  if (rule.frequency === 'weekly') {
    for (let d = new Date(start); d <= hardEnd; d = new Date(d.getTime() + 7 * 86400000)) {
      out.push(isoDay(d));
    }
    return out;
  }

  // 'monthly' | 'yearly': caminhar mês a mês. O dia desejado é preservado
  // (até 31) e clampado ao último dia REAL de cada mês na hora da ocorrência
  // (ex: dia 31 vira 28/29 em fevereiro).
  const day = Math.min(Math.max(rule.dayOfMonth || start.getDate(), 1), 31);
  const monthsLimit = rule.frequency === 'monthly' ? 1200 : 120; // trava de segurança (100 anos / 10 anos)
  let y = start.getFullYear();
  let m = start.getMonth();
  let steps = 0;

  while (steps < monthsLimit) {
    const occDate = new Date(y, m, Math.min(day, daysInMonth(y, m)));
    if (occDate >= start) {
      if (occDate > hardEnd) break;
      out.push(isoDay(occDate));
    }
    if (rule.frequency === 'monthly') m += 1;
    else m += 12;
    if (m > 11) {
      y += Math.floor(m / 12);
      m = m % 12;
    }
    steps += 1;
  }

  return out;
}

/**
 * Materializa todas as regras ativas em transações, sem duplicar ocorrências
 * que já existam (identificadas pela tag `rec:<id>:<YYYY-MM-DD>`).
 */
export function materializeRecurringTransactions(
  rules: RecurrenceRule[],
  existingTransactions: Transaction[],
  userId: string,
  today = new Date()
): Transaction[] {
  const nowIso = new Date().toISOString();
  // Índice de marcadores já materializados (tags em qualquer transação).
  const existingMarkers = new Set<string>();
  for (const t of existingTransactions) {
    for (const tag of t.tags || []) {
      if (tag.startsWith('rec:')) existingMarkers.add(tag);
    }
  }

  const created: Transaction[] = [];

  for (const rule of rules) {
    for (const date of getRuleOccurrences(rule, today)) {
      const marker = `rec:${rule.id}:${date}`;
      if (existingMarkers.has(marker)) continue;

      created.push({
        id: `txr_${rule.id}_${date.replace(/-/g, '')}`,
        userId,
        accountId: rule.accountId ?? null,
        description: rule.description,
        amount: Math.abs(rule.amount),
        type: rule.type,
        category: rule.category,
        source: 'recurring',
        occurredAt: date,
        createdAt: nowIso,
        tags: [marker],
      });
      existingMarkers.add(marker);
    }
  }

  return created;
}

/**
 * Lista simples de ocorrências futuras de uma regra (para o copiloto /
 * pré-aviso de despesas fixas), limitado a `months` meses à frente.
 */
export function getUpcomingOccurrences(rule: RecurrenceRule, months = 6): { date: string; amount: number }[] {
  if (!rule.active) return [];
  const start = new Date(`${rule.startDate}T00:00:00`);
  if (isNaN(start.getTime())) return [];

  const out: { date: string; amount: number }[] = [];
  const now = new Date();
  const day = Math.min(Math.max(rule.dayOfMonth || start.getDate(), 1), 28);

  for (let i = 1; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    if (rule.frequency === 'weekly') {
      // aproximação: 4,3 semanas por mês não faz sentido exibir; usa 4 por mês
      for (let w = 0; w < 4; w++) {
        const occ = new Date(d.getFullYear(), d.getMonth(), 1 + w * 7);
        out.push({ date: isoDay(occ), amount: Math.abs(rule.amount) });
      }
    } else {
      const occMonth = rule.frequency === 'monthly' ? d.getMonth() : start.getMonth();
      const occ = new Date(d.getFullYear(), occMonth, Math.min(day, daysInMonth(d.getFullYear(), occMonth)));
      out.push({ date: isoDay(occ), amount: Math.abs(rule.amount) });
    }
    if (rule.endDate && new Date(`${rule.endDate}T00:00:00`) < new Date(`${out[out.length - 1].date}T00:00:00`)) break;
  }

  return out;
}

export const recurrenceEngineInternals = { isoDay, monthKeyOf, daysInMonth };
