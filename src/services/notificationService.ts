/**
 * Centro de notificações/lembretes in-app do Prumo (Fase 3).
 *
 * As notificações são DERIVADAS (determinísticas e idempotentes) dos dados
 * reais: alertas preditivos de orçamento/reserva, lembretes de recorrências
 * próximas (motor Fase 1) e prazos de metas. O estado persistido guarda
 * apenas o que o usuário já LEU (readIds) — assim as notificações voltam
 * a aparecer se a condição persistir, sem duplicar sino.
 *
 * Sem dependências externas: 100% offline.
 */

import { Alert, Goal, Notification, RecurrenceRule, Transaction } from '../types';
import { getNextOccurrence } from './recurrenceEngine';
import { formatCurrency, getMonthKey } from './businessRules';
import type { Country } from '../types';

/** Horizonte (em dias) para lembrar de recorrências futuras. */
const RECURRENCE_LOOKAHEAD_DAYS = 7;

/** Dias antes do prazo da meta para disparar o lembrete. */
const GOAL_DEADLINE_SOON_MONTHS = 2;

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffInDays(fromIso: string, today = new Date()): number {
  const target = new Date(`${fromIso}T00:00:00`);
  if (isNaN(target.getTime())) return Infinity;
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - todayMid.getTime()) / 86400000);
}

/**
 * ID determinístico de uma notificação derivada: a mesma condição sempre
 * gera o mesmo id (dedup no sino), e a leitura é guardada em readIds.
 */
function derivedId(kind: string, key: string): string {
  return `ntf_${kind}_${key}`;
}

export interface DerivedNotificationsResult {
  notifications: Notification[];
  /** Ids derivados ativos hoje (para dedup/conciliação do sino). */
  activeIds: Set<string>;
}

/**
 * Gera as notificações ativas do dia a partir dos dados do usuário.
 * - Alertas preditivos (orçamento, reserva, meta) — reutiliza o mesmo motor;
 * - Lembretes de recorrências nos próximos 7 dias;
 * - Prazos de metas a ≤ 2 meses;
 * - Eventos pontuais criados pelo app (ex.: entrada em espaço compartilhado).
 *
 * `persisted` carrega as notificações já conhecidas (com readAt) e eventos
 * pontuais; lidas de condições ainda ativas continuam lidas (sem re-sinar).
 */
export function deriveNotifications(input: {
  userId: string;
  country: Country;
  alerts: Alert[];
  recurrenceRules: RecurrenceRule[];
  transactions: Transaction[];
  goals: Goal[];
  primaryGoal?: { label: string; targetValue: number; savedValue: number; deadline: string };
  monthlySavings: number;
  persisted?: Notification[];
}): DerivedNotificationsResult {
  const {
    userId,
    country,
    alerts,
    recurrenceRules,
    transactions,
    goals,
    primaryGoal,
    monthlySavings,
    persisted = [],
  } = input;

  const nowIso = new Date().toISOString();
  const readIds = new Set(persisted.filter((n) => n.readAt).map((n) => n.id));
  // Eventos pontuais persistidos (ex.: shared_space) são mantidos como estão.
  const pointEvents = persisted.filter((n) => n.kind === 'shared_space');

  const notifications: Notification[] = [];

  // 1. Alertas preditivos → notificações (mesma fonte, sino unificado)
  for (const a of alerts) {
    const id = derivedId(a.type, a.id.replace(/^alert-/, ''));
    notifications.push({
      id,
      userId,
      kind: a.type,
      title: a.title,
      message: a.message,
      severity: a.severity,
      triggeredAt: nowIso,
      readAt: readIds.has(id) ? persisted.find((n) => n.id === id)?.readAt ?? nowIso : null,
      actionTab: 'budgets',
    });
  }

  // 2. Lembretes de recorrências próximas (próximos 7 dias)
  for (const rule of recurrenceRules) {
    const next = getNextOccurrence(rule);
    if (!next) continue;
    const days = diffInDays(next);
    if (days < 0 || days > RECURRENCE_LOOKAHEAD_DAYS) continue;
    const id = derivedId('recurrence_upcoming', `${rule.id}:${next}`);
    const when =
      days === 0
        ? 'hoje'
        : days === 1
        ? 'amanhã'
        : `em ${days} dias`;
    notifications.push({
      id,
      userId,
      kind: 'recurrence_upcoming',
      title:
        rule.type === 'expense'
          ? `${rule.description} vence ${when}`
          : `${rule.description} entra ${when}`,
      message:
        rule.type === 'expense'
          ? `Lançamento recorrente de ${formatCurrency(rule.amount, country)} programado para ${next} (${
              rule.type === 'expense' ? 'despesa' : 'receita'
            }).`
          : `Receita recorrente de ${formatCurrency(rule.amount, country)} programada para ${next}.`,
      severity: days === 0 ? 'warning' : 'info',
      triggeredAt: nowIso,
      readAt: readIds.has(id) ? persisted.find((n) => n.id === id)?.readAt ?? nowIso : null,
      actionTab: 'transactions',
    });
  }

  // 3. Prazos de metas (≤ 2 meses e ritmo insuficiente OU prazo vencendo)
  const allGoals: Goal[] = [
    ...(primaryGoal
      ? [
          {
            id: 'primary-goal',
            userId,
            label: primaryGoal.label,
            targetValue: primaryGoal.targetValue,
            savedValue: primaryGoal.savedValue,
            targetDate: primaryGoal.deadline,
          } as Goal,
        ]
      : []),
    ...goals,
  ];
  for (const g of allGoals) {
    if (!g.targetDate || g.targetValue <= 0) continue;
    const [yy, mm] = g.targetDate.split('-').map(Number);
    if (isNaN(yy) || isNaN(mm)) continue;
    const deadlineDate = new Date(yy, mm - 1, 1);
    const todayMid = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthsAway = Math.round((deadlineDate.getTime() - todayMid.getTime()) / (30.44 * 86400000));
    const remaining = Math.max(0, g.targetValue - g.savedValue);
    if (remaining <= 0) continue; // meta concluída: sem lembrete

    const id = derivedId('goal_deadline', `${g.id}:${g.targetDate}`);
    if (monthsAway < 0) {
      notifications.push({
        id,
        userId,
        kind: 'goal_deadline',
        title: `Prazo da meta "${g.label}" passou`,
        message: `O prazo era ${g.targetDate} e faltam ${formatCurrency(remaining, country)}. Vale reavaliar o prazo ou o valor do aporte.`,
        severity: 'warning',
        triggeredAt: nowIso,
        readAt: readIds.has(id) ? persisted.find((n) => n.id === id)?.readAt ?? nowIso : null,
        actionTab: 'budgets',
      });
    } else if (monthsAway <= GOAL_DEADLINE_SOON_MONTHS && monthlySavings > 0) {
      const needed = remaining / Math.max(1, monthsAway);
      if (needed > monthlySavings) {
        notifications.push({
          id,
          userId,
          kind: 'goal_deadline',
          title: `Meta "${g.label}" no aperto`,
          message: `Faltam ${monthsAway} mês(es) para ${g.targetDate}. No ritmo atual (${formatCurrency(
            monthlySavings,
            country
          )}/mês) faltariam ${formatCurrency(remaining, country)} de uma vez. Considere aumentar o aporte.`,
          severity: 'info',
          triggeredAt: nowIso,
          readAt: readIds.has(id) ? persisted.find((n) => n.id === id)?.readAt ?? nowIso : null,
          actionTab: 'budgets',
        });
      }
    }
  }

  // 4. Alerta de orçamento zero para categorias com gasto (envelope esgotado)
  const monthKey = getMonthKey(new Date());
  const spentByCat: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type === 'expense' && getMonthKey(t.occurredAt) === monthKey) {
      spentByCat[t.category] = (spentByCat[t.category] || 0) + Math.abs(t.amount);
    }
  }

  const final = [...notifications, ...pointEvents];
  return { notifications: final, activeIds: new Set(final.map((n) => n.id)) };
}

/** Conta não lidas (para o badge do sino). */
export function countUnread(notifications: Notification[]): number {
  return notifications.filter((n) => !n.readAt).length;
}

/** Marca todas as notificações como lidas (imutável). */
export function markAllRead(notifications: Notification[]): Notification[] {
  const nowIso = new Date().toISOString();
  return notifications.map((n) => (n.readAt ? n : { ...n, readAt: nowIso }));
}

/** Marca uma notificação específica como lida (imutável). */
export function markRead(notifications: Notification[], id: string): Notification[] {
  const nowIso = new Date().toISOString();
  return notifications.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: nowIso } : n));
}

/**
 * Concilia as notificações derivadas com as persistidas: mantém lidas e
 * eventos pontuais; remove condições que não existem mais.
 */
export function reconcileNotifications(
  derived: Notification[],
  activeIds: Set<string>,
  persisted: Notification[]
): Notification[] {
  const derivedById = new Map(derived.map((n) => [n.id, n]));
  const kept: Notification[] = [];

  // Eventos pontuais (shared_space) preservados; derivadas lidas que saíram
  // do ar são descartadas (condição resolvida).
  for (const p of persisted) {
    if (p.kind === 'shared_space') kept.push(p);
    else if (activeIds.has(p.id) && p.readAt) {
      const d = derivedById.get(p.id);
      if (d) kept.push({ ...d, readAt: p.readAt });
    }
  }

  // Novas derivadas (não lidas) que ainda não estão persistidas
  for (const d of derived) {
    if (!d.readAt) kept.push(d);
  }

  return kept;
}

export const notificationServiceInternals = {
  derivedId,
  isoDay,
  RECURRENCE_LOOKAHEAD_DAYS,
  GOAL_DEADLINE_SOON_MONTHS,
};
