/**
 * Testes da Fase 3 do Prumo:
 * 1. Metas por categoria (método envelope/YNAB): buildYnabMonthContext,
 *    rollover de envelopes, para atribuir, sugestão por histórico;
 * 2. Ritmo de metas: computeGoalPace;
 * 3. Notificações: getNextOccurrence + deriveNotifications + leitura persistida
 *    + reconciliação (dedup) + markAllRead;
 * 4. Recorrências: getNextOccurrence mensal/anual/weekly + clamp dia 31.
 */

import {
  buildYnabMonthContext,
  suggestAllocationFromHistory,
  computeGoalPace,
  getCurrentMonthKey,
} from '../src/services/businessRules';
import { getNextOccurrence } from '../src/services/recurrenceEngine';
import {
  deriveNotifications,
  countUnread,
  markAllRead,
  reconcileNotifications,
} from '../src/services/notificationService';
import {
  CategoryAllocation,
  Transaction,
  RecurrenceRule,
  Goal,
  Alert,
} from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Test Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

function tx(
  overrides: Partial<Transaction> & { occurredAt: string; amount: number; type: 'income' | 'expense' }
): Transaction {
  return {
    id: `tx_${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    description: 'Teste',
    category: 'Outros',
    source: 'manual',
    createdAt: overrides.occurredAt,
    ...overrides,
  } as Transaction;
}

function runTests() {
  console.log('\n--- 🧪 Testes da Fase 3 (envelope YNAB + notificações + recorrências) ---\n');

  const currentMonth = getCurrentMonthKey();
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // ── Teste 1: Para atribuir = receitas − atribuições do mês ──
  const allocations: CategoryAllocation[] = [
    { id: 'a1', userId: 'user-1', category: 'Alimentação', monthKey: currentMonth, amount: 600, createdAt: '' },
    { id: 'a2', userId: 'user-1', category: 'Transporte', monthKey: currentMonth, amount: 200, createdAt: '' },
  ];

  const monthTxs: Transaction[] = [
    tx({ occurredAt: `${currentMonth}-05`, amount: 3000, type: 'income', category: 'Salário / Honorários' }),
    tx({ occurredAt: `${currentMonth}-10`, amount: 150, type: 'expense', category: 'Alimentação' }),
    tx({ occurredAt: `${currentMonth}-12`, amount: 80, type: 'expense', category: 'Transporte' }),
  ];

  const ctx = buildYnabMonthContext(allocations, monthTxs);
  assert(ctx.toAllocate === 3000 - 800, `Para atribuir deve ser 2200 (recebido: ${ctx.toAllocate})`);

  const food = ctx.categories.find((c) => c.category === 'Alimentação')!;
  assert(!!food, 'Envelope de Alimentação deve existir');
  assert(food.available === 600, `Disponível de Alimentação deve ser 600 (600 atribuído, rollover 0) — recebido: ${food.available}`);
  assert(food.spent === 150, 'Gasto de Alimentação deve ser 150');
  assert(food.remaining === 450, `Restante de Alimentação deve ser 450 (recebido: ${food.remaining})`);
  assert(food.status === 'within', 'Alimentação (25% do envelope) deve estar "within"');

  // ── Teste 2: Rollover de meses anteriores ──
  const prevTxs: Transaction[] = [
    tx({ occurredAt: `${prevMonth}-08`, amount: 1000, type: 'expense', category: 'Saúde' }),
  ];
  const prevAllocations: CategoryAllocation[] = [
    { id: 'a3', userId: 'user-1', category: 'Saúde', monthKey: prevMonth, amount: 700, createdAt: '' },
  ];

  const ctx2 = buildYnabMonthContext(
    [...allocations, ...prevAllocations],
    [...monthTxs, ...prevTxs]
  );
  const health = ctx2.categories.find((c) => c.category === 'Saúde')!;
  assert(!!health, 'Envelope de Saúde deve existir (rolagem de mês anterior)');
  // Atribuído 700 no mês passado, gasto 1000 → rollover -300; sem atribuição neste mês.
  assert(health.carriedOver === -300, `Rollover de Saúde deve ser -300 (recebido: ${health.carriedOver})`);
  assert(health.status === 'exceeded', 'Envelope negativo com gasto deve ser "exceeded"');
  // O gasto do mês passado não conta no mês corrente:
  assert(health.spent === 0, 'Gasto do mês corrente de Saúde deve ser 0');

  // ── Teste 3: Sugestão por histórico (média 3 meses +10%) ──
  const histTxs: Transaction[] = [
    tx({ occurredAt: '2026-05-10', amount: 100, type: 'expense', category: 'Lazer & Cultura' }),
    tx({ occurredAt: '2026-06-11', amount: 200, type: 'expense', category: 'Lazer & Cultura' }),
    tx({ occurredAt: '2026-07-12', amount: 300, type: 'expense', category: 'Lazer & Cultura' }),
  ];
  const suggestion = suggestAllocationFromHistory('Lazer & Cultura', histTxs, 3);
  assert(
    Math.abs(suggestion - 220) < 0.01,
    `Sugestão deve ser média 200 * 1.1 = 220 (recebido: ${suggestion})`
  );
  const noHistory = suggestAllocationFromHistory('Categoria Inexistente', histTxs);
  assert(noHistory === 0, 'Categoria sem histórico sugere 0');

  // ── Teste 4: Ritmo de metas (computeGoalPace) ──
  const goalPace = computeGoalPace(
    { targetValue: 12000, savedValue: 0, targetDate: '2027-09' },
    1000,
    new Date(2026, 8, 15) // set/2026 → 12 meses
  );
  assert(goalPace.remaining === 12000, 'Restante da meta deve ser 12000');
  assert(goalPace.monthsRemaining === 12, `Deve haver ~12 meses (recebido: ${goalPace.monthsRemaining})`);
  assert(goalPace.requiredMonthly === 1000, `Aporte necessário deve ser 1000 (recebido: ${goalPace.requiredMonthly})`);
  assert(goalPace.onTrack === true, 'Poupança de 1000/mês cobre a meta');

  const behind = computeGoalPace({ targetValue: 12000, savedValue: 0, targetDate: '2027-09' }, 500, new Date(2026, 8, 15));
  assert(behind.onTrack === false, 'Poupança de 500/mês não cobre 1000/mês necessários');

  const noDeadline = computeGoalPace({ targetValue: 5000, savedValue: 1000 }, 0);
  assert(noDeadline.onTrack === null, 'Sem prazo, ritmo é indefinido (null)');
  const done = computeGoalPace({ targetValue: 5000, savedValue: 5000 }, 0);
  assert(done.onTrack === true && done.remaining === 0, 'Meta concluída está no rumo');

  // ── Teste 5: getNextOccurrence ──
  const monthlyRule: RecurrenceRule = {
    id: 'r1',
    userId: 'user-1',
    description: 'Aluguel',
    amount: 1500,
    type: 'expense',
    category: 'Moradia',
    frequency: 'monthly',
    dayOfMonth: 5,
    startDate: '2026-01-05',
    active: true,
    createdAt: '2026-01-01',
  };
  const next = getNextOccurrence(monthlyRule, new Date(2026, 8, 28)); // 28/set → 5/out
  assert(next === '2026-10-05', `Próxima ocorrência mensal deve ser 2026-10-05 (recebido: ${next})`);

  const sameDay = getNextOccurrence(monthlyRule, new Date(2026, 9, 5));
  assert(sameDay === '2026-11-05', 'No dia da ocorrência, a próxima é no mês seguinte');

  const day31Rule: RecurrenceRule = { ...monthlyRule, dayOfMonth: 31 };
  const nextClamped = getNextOccurrence(day31Rule, new Date(2027, 0, 15)); // 15/jan → 31/jan
  assert(nextClamped === '2027-01-31', `Dia 31 deve existir em janeiro (recebido: ${nextClamped})`);
  const febClamped = getNextOccurrence(day31Rule, new Date(2027, 1, 1)); // 1/fev → 28/fev
  assert(febClamped === '2027-02-28', `Dia 31 em fevereiro clamp para 28 (recebido: ${febClamped})`);

  const yearlyRule: RecurrenceRule = {
    ...monthlyRule,
    id: 'r2',
    frequency: 'yearly',
    dayOfMonth: 25,
    startDate: '2025-12-25',
  };
  const nextYearly = getNextOccurrence(yearlyRule, new Date(2026, 8, 28));
  assert(nextYearly === '2026-12-25', `Anual deve voltar em 2026-12-25 (recebido: ${nextYearly})`);

  const inactive = getNextOccurrence({ ...monthlyRule, active: false }, new Date(2026, 8, 28));
  assert(inactive === null, 'Regra inativa não tem próxima ocorrência');

  const endedRule = getNextOccurrence(
    { ...monthlyRule, endDate: '2026-09-30' },
    new Date(2026, 9, 15)
  );
  assert(endedRule === null, 'Regra com endDate no passado não tem próxima ocorrência');

  // ── Teste 6: deriveNotifications — lembretes de recorrência + lidas persistidas ──
  const alerts: Alert[] = [];
  const rules: RecurrenceRule[] = [monthlyRule];
  // Hoje = 28/set/2026: próxima ocorrência 05/out → 7 dias → dentro da janela
  const derived = deriveNotifications({
    userId: 'user-1',
    country: 'BR',
    alerts,
    recurrenceRules: rules,
    transactions: [],
    goals: [],
    monthlySavings: 0,
    persisted: [],
  });
  const recNotif = derived.notifications.find((n) => n.kind === 'recurrence_upcoming');
  assert(!!recNotif, 'Deve derivar lembrete de recorrência próxima');
  assert(
    recNotif?.message.includes('Kz') === false,
    'Moeda BR usa R$ (Kz só em AO)'
  );

  // A mesma condição gera o MESMO id (idempotência do sino)
  const derived2 = deriveNotifications({
    userId: 'user-1',
    country: 'BR',
    alerts,
    recurrenceRules: rules,
    transactions: [],
    goals: [],
    monthlySavings: 0,
    persisted: [],
  });
  assert(
    derived2.notifications[0].id === derived.notifications[0].id,
    'IDs determinísticos: mesma condição → mesmo id'
  );

  // Leitura persistida: condição ativa + readAt → permanece lida
  const withRead = deriveNotifications({
    userId: 'user-1',
    country: 'BR',
    alerts,
    recurrenceRules: rules,
    transactions: [],
    goals: [],
    monthlySavings: 0,
    persisted: [{ ...derived.notifications[0], readAt: '2026-09-28T10:00:00Z' }],
  });
  assert(
    withRead.notifications.find((n) => n.id === derived.notifications[0].id)?.readAt != null,
    'Notificação lida permanece lida enquanto a condição persiste'
  );

  // Reconciliação: mantém lidas ativas + remove resolvidas + preserva pontuais
  const reconciled = reconcileNotifications(
    withRead.notifications,
    withRead.activeIds,
    [
      { ...derived.notifications[0], readAt: '2026-09-28T10:00:00Z' },
      {
        id: 'ntf_shared_space_123',
        userId: 'user-1',
        kind: 'shared_space',
        title: 'Você entrou no espaço "Casa"',
        message: '',
        severity: 'info',
        triggeredAt: '',
      },
      {
        id: 'ntf_recurrence_upcoming_antigo',
        userId: 'user-1',
        kind: 'recurrence_upcoming',
        title: 'condição antiga',
        message: '',
        severity: 'info',
        triggeredAt: '',
      },
    ]
  );
  assert(
    reconciled.some((n) => n.id === derived.notifications[0].id),
    'Leitura ativa deve ser mantida na reconciliação'
  );
  assert(
    reconciled.some((n) => n.kind === 'shared_space'),
    'Evento pontual (shared_space) é preservado'
  );
  assert(
    !reconciled.some((n) => n.id === 'ntf_recurrence_upcoming_antigo'),
    'Condição derivada antiga/resolvida é descartada'
  );

  // ── Teste 7: prazos de metas geram lembretes quando o ritmo não basta ──
  const goals: Goal[] = [
    {
      id: 'g1',
      userId: 'user-1',
      label: 'Intercâmbio',
      targetValue: 6000,
      savedValue: 0,
      targetDate: '2026-11', // ~2 meses após set/2026
    },
  ];
  const withGoals = deriveNotifications({
    userId: 'user-1',
    country: 'BR',
    alerts,
    recurrenceRules: [],
    transactions: [],
    goals,
    monthlySavings: 500,
    persisted: [],
  });
  const goalNotif = withGoals.notifications.find((n) => n.kind === 'goal_deadline');
  assert(!!goalNotif, 'Meta no aperto (2 meses, aporte insuficiente) deve gerar lembrete');

  // ── Teste 8: marcação de leitura ──
  const before = withGoals.notifications;
  assert(countUnread(before) === before.length, 'Todas derivadas começam não lidas');
  const afterMark = markAllRead(before);
  assert(countUnread(afterMark) === 0, 'markAllRead zera não lidas');
  assert(countUnread(before) === before.length, 'markAllRead não muta o array original');

  console.log('\n🎉 TODOS OS TESTES DA FASE 3 PASSARAM!\n');
}

runTests();
