import {
  Account,
  Transaction,
  BudgetLimit,
  BudgetAnalysis,
  BudgetStatus,
  ScenarioEvent,
  MonthProjection,
  Country,
  FinancialSnapshot,
  Alert,
  UserProfile,
} from '../types';

/**
 * Retorna a chave 'YYYY-MM' de uma data (string ISO ou Date), em fuso local.
 */
export function getMonthKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Chave do mês corrente (fuso local do dispositivo).
 */
export function getCurrentMonthKey(): string {
  return getMonthKey(new Date());
}

/**
 * Formatação de moeda por país
 * BR: R$ 1.250,00
 * AO: Kz 1.250,00 ou 1.250,00 Kz
 */
export function formatCurrency(amount: number, country: Country = 'BR'): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  const absValue = Math.abs(safeAmount);
  const formatted = new Intl.NumberFormat(country === 'BR' ? 'pt-BR' : 'pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absValue);

  const sign = safeAmount < 0 ? '-' : '';

  if (country === 'BR') {
    return `${sign}R$ ${formatted}`;
  } else {
    return `${sign}Kz ${formatted}`;
  }
}

/**
 * Formatação de datas amigável (DD/MM/AAAA ou mês por extenso)
 */
export function formatDate(dateString: string | Date, country: Country = 'BR'): string {
  if (!dateString) return '';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(country === 'BR' ? 'pt-BR' : 'pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Formatação de mês abreviado (ex: "Out/26")
 */
export function formatMonthYear(dateString: string | Date, country: Country = 'BR'): string {
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return '';
  const month = new Intl.DateTimeFormat(country === 'BR' ? 'pt-BR' : 'pt-AO', {
    month: 'short',
    year: '2-digit',
  }).format(d);
  return month.charAt(0).toUpperCase() + month.slice(1);
}

/**
 * Cálculo de saldo agregado de contas bancárias e manuais
 */
export function calculateAggregatedBalance(accounts: Account[]): number {
  return accounts.reduce((acc, account) => acc + (account.balance || 0), 0);
}

/**
 * Cálculo de totais e taxa de poupança (Savings Rate)
 * Taxa de poupança = (receitas - despesas) / receitas
 * Caso receitas <= 0, retorna 0 (ou valor negativo se houver déficit explícito)
 *
 * Por padrão considera apenas o MÊS CORRENTE (os rótulos do app falam em
 * "Receitas do Mês"). Passe `{ monthKey: null }` para somar todo o histórico
 * ou `{ monthKey: '2026-09' }` para um mês específico.
 */
export function calculateTotals(
  transactions: Transaction[],
  options?: { monthKey?: string | null }
): {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;
} {
  const monthKey = options?.monthKey === undefined ? getCurrentMonthKey() : options.monthKey;
  const scoped =
    monthKey && monthKey !== null
      ? transactions.filter((t) => getMonthKey(t.occurredAt) === monthKey)
      : transactions;

  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of scoped) {
    if (t.type === 'income') {
      totalIncome += Math.abs(t.amount);
    } else if (t.type === 'expense') {
      totalExpense += Math.abs(t.amount);
    }
  }

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) : 0;

  return {
    totalIncome,
    totalExpense,
    netSavings,
    savingsRate: Number(savingsRate.toFixed(4)),
  };
}

/**
 * Regra de Status de Orçamento por Categoria
 * - 'within' (< 80% do limite)
 * - 'warning' (>= 80% e <= 100% do limite)
 * - 'exceeded' (> 100% do limite)
 */
export function calculateBudgetStatus(spent: number, limit: number): {
  status: BudgetStatus;
  percentage: number;
  remaining: number;
} {
  const safeLimit = limit <= 0 ? 0.01 : limit;
  const percentage = (spent / safeLimit) * 100;
  const remaining = Math.max(0, limit - spent);

  let status: BudgetStatus = 'within';
  if (percentage > 100) {
    status = 'exceeded';
  } else if (percentage >= 80) {
    status = 'warning';
  }

  return {
    status,
    percentage: Number(percentage.toFixed(1)),
    remaining,
  };
}

/**
 * Análise consolidada de todos os limites de orçamento.
 * Por padrão considera apenas o MÊS CORRENTE; use `{ monthKey: null }` para
 * analisar todo o histórico ou uma chave 'YYYY-MM' específica.
 */
export function analyzeBudgets(
  budgetLimits: BudgetLimit[],
  currentMonthTransactions: Transaction[],
  options?: { monthKey?: string | null }
): BudgetAnalysis[] {
  const monthKey = options?.monthKey === undefined ? getCurrentMonthKey() : options.monthKey;
  const scoped =
    monthKey && monthKey !== null
      ? currentMonthTransactions.filter((t) => getMonthKey(t.occurredAt) === monthKey)
      : currentMonthTransactions;

  // Agrupar gastos por categoria
  const spentByCategory: Record<string, number> = {};
  for (const t of scoped) {
    if (t.type === 'expense') {
      spentByCategory[t.category] = (spentByCategory[t.category] || 0) + Math.abs(t.amount);
    }
  }

  return budgetLimits.map((limitItem) => {
    const spent = spentByCategory[limitItem.category] || 0;
    const { status, percentage, remaining } = calculateBudgetStatus(spent, limitItem.monthlyLimit);

    return {
      category: limitItem.category,
      monthlyLimit: limitItem.monthlyLimit,
      spent,
      percentage,
      remaining,
      status,
    };
  });
}

/**
 * Projeção de Cenários de 24 meses
 * Calcula a evolução patrimonial com e sem os eventos do cenário
 */
export function projectScenarios(
  initialBalance: number,
  baseMonthlyIncome: number,
  baseMonthlyExpense: number,
  events: ScenarioEvent[],
  monthsCount: number = 24
): MonthProjection[] {
  const enabledEvents = events.filter((e) => e.enabled);
  const projections: MonthProjection[] = [];

  let currentBaselineBalance = initialBalance;
  let currentScenarioBalance = initialBalance;

  const now = new Date();

  for (let month = 1; month <= monthsCount; month++) {
    // Calcular mês calendário para a label
    const projDate = new Date(now.getFullYear(), now.getMonth() + month, 1);
    const monthLabel = `Mês ${month} (${formatMonthYear(projDate)})`;

    // Baseline mensal simples
    const monthBaselineIncome = baseMonthlyIncome;
    const monthBaselineExpense = baseMonthlyExpense;
    currentBaselineBalance += monthBaselineIncome - monthBaselineExpense;

    // Calcular impacto dos eventos habilitados para este mês
    let deltaIncome = 0;
    let deltaExpense = 0;
    const activeEventsThisMonth: string[] = [];

    for (const evt of enabledEvents) {
      const isStarted = month >= evt.startMonth;
      const isNotExpired = !evt.durationMonths || month < evt.startMonth + evt.durationMonths;

      if (isStarted && isNotExpired) {
        activeEventsThisMonth.push(evt.label);
        if (evt.type === 'income') {
          deltaIncome += evt.monthlyDelta;
        } else {
          // Despesa aumenta se delta for positivo
          deltaExpense += Math.abs(evt.monthlyDelta);
        }
      }

      // Custo único aplicado apenas no mês de início
      if (month === evt.startMonth && evt.oneTimeCost && evt.oneTimeCost > 0) {
        deltaExpense += evt.oneTimeCost;
        if (!activeEventsThisMonth.includes(evt.label)) {
          activeEventsThisMonth.push(evt.label);
        }
      }
    }

    const monthScenarioIncome = Math.max(0, monthBaselineIncome + deltaIncome);
    const monthScenarioExpense = Math.max(0, monthBaselineExpense + deltaExpense);

    currentScenarioBalance += monthScenarioIncome - monthScenarioExpense;

    projections.push({
      monthIndex: month,
      monthLabel,
      baselineBalance: Math.round(currentBaselineBalance),
      scenarioBalance: Math.round(currentScenarioBalance),
      deltaNet: Math.round(currentScenarioBalance - currentBaselineBalance),
      incomeBaseline: Math.round(monthBaselineIncome),
      incomeScenario: Math.round(monthScenarioIncome),
      expenseBaseline: Math.round(monthBaselineExpense),
      expenseScenario: Math.round(monthScenarioExpense),
      activeEvents: activeEventsThisMonth,
    });
  }

  return projections;
}

/**
 * Geração de Alertas Preditivos baseados no perfil e dados reais
 */
export function generatePredictiveAlerts(
  profile: UserProfile,
  accounts: Account[],
  currentMonthTransactions: Transaction[],
  budgetLimits: BudgetLimit[]
): Alert[] {
  const alerts: Alert[] = [];
  const aggregatedBalance = calculateAggregatedBalance(accounts);
  const { totalExpense } = calculateTotals(currentMonthTransactions);
  const budgets = analyzeBudgets(budgetLimits, currentMonthTransactions);

  // 1. Alerta de Orçamento Excedido ou em Atenção
  for (const b of budgets) {
    if (b.status === 'exceeded') {
      alerts.push({
        id: `alert-budget-exceeded-${b.category}`,
        userId: 'current-user',
        type: 'budget_exceeded',
        title: `Orçamento de ${b.category} estourado`,
        message: `Você ultrapassou o teto estipulado (${b.percentage}% gasto). Restam 0 de margem este mês.`,
        severity: 'danger',
        triggeredAt: new Date().toISOString(),
      });
    } else if (b.status === 'warning') {
      alerts.push({
        id: `alert-budget-warn-${b.category}`,
        userId: 'current-user',
        type: 'budget_warning',
        title: `Atenção ao orçamento de ${b.category}`,
        message: `Você já consumiu ${b.percentage}% do limite mensal definido.`,
        severity: 'warning',
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  // 2. Alerta de Reserva de Emergência adaptado à profissão
  // Autônomos/Freelancers/Médicos/Comerciantes precisam de 6-12 meses de custo de vida
  // CLT/Funcionários públicos precisam de 3-6 meses
  const isVariableIncome = /freelance|autonom|medico|médico|designer|comerciante|pj|consultor|empresari|empresári/i.test(
    profile.profession || ''
  );
  const recommendedMonths = isVariableIncome ? 6 : 3;
  const estimatedMonthlyBurn = totalExpense > 0 ? totalExpense : profile.monthlyIncomeExpectation * 0.7;
  const currentCoverageMonths = estimatedMonthlyBurn > 0 ? aggregatedBalance / estimatedMonthlyBurn : 0;

  if (currentCoverageMonths < recommendedMonths) {
    alerts.push({
      id: 'alert-emergency-reserve',
      userId: 'current-user',
      type: 'emergency_fund',
      title: 'Reserva de emergência abaixo do recomendado',
      message: `Para a profissão de ${profile.profession || 'sua área'}, a recomendação prudente é ter ${recommendedMonths} meses de despesas (${formatCurrency(estimatedMonthlyBurn * recommendedMonths)}). Seu saldo cobre cerca de ${currentCoverageMonths.toFixed(1)} meses.`,
      severity: currentCoverageMonths < 1.5 ? 'danger' : 'warning',
      triggeredAt: new Date().toISOString(),
    });
  }

  // 3. Progresso da meta primária
  if (profile.primaryGoal && profile.goalTargetValue > 0) {
    const goalPercent = (profile.goalSavedValue / profile.goalTargetValue) * 100;
    if (goalPercent >= 100) {
      alerts.push({
        id: 'alert-goal-reached',
        userId: 'current-user',
        type: 'goal_progress',
        title: `Parabéns! Meta alcançada: ${profile.primaryGoal}`,
        message: `Você atingiu 100% do valor estipulado. Considere definir um novo marco financeiro.`,
        severity: 'info',
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

/**
 * Constrói o bloco "Retrato financeiro atual" exigido na Seção 5 para o prompt do Copiloto
 */
export function buildFinancialPortraitMarkdown(snapshot: FinancialSnapshot): string {
  const c = snapshot.user.country;
  const cur = c === 'BR' ? 'R$' : 'Kz';

  const categoryBreakdown = Object.entries(snapshot.past90DaysByCategory)
    .map(([cat, stats]) => `- ${cat}: ${formatCurrency(stats.expense, c)} em despesas (${stats.count} lançamentos)`)
    .join('\n');

  const budgetBreakdown = snapshot.budgets
    .map(
      (b) =>
        `- ${b.category}: ${formatCurrency(b.spent, c)} gastos de ${formatCurrency(b.monthlyLimit, c)} (${b.percentage}%) [${b.status}]`
    )
    .join('\n');

  let scenarioInfo = 'Nenhuma simulação ativa.';
  if (snapshot.activeScenarioSummary) {
    scenarioInfo = `${snapshot.activeScenarioSummary.enabledEventsCount} eventos ativados. Projeção em 24 meses: Saldo base ${formatCurrency(
      snapshot.activeScenarioSummary.month24Baseline,
      c
    )} vs Saldo com Cenário ${formatCurrency(
      snapshot.activeScenarioSummary.month24Scenario,
      c
    )} (diferença de ${formatCurrency(snapshot.activeScenarioSummary.difference, c)}).`;
  }

  return `
### Retrato financeiro atual
- **Usuário:** ${snapshot.user.name}
- **País:** ${c === 'BR' ? 'Brasil (BRL / R$)' : 'Angola (AOA / Kz)'}
- **Profissão:** ${snapshot.user.profession || 'Não informada'}
- **Meta principal:** ${snapshot.user.primaryGoal || 'Não informada'} (Alvo: ${formatCurrency(snapshot.user.goalTargetValue, c)}, Guardado: ${formatCurrency(snapshot.user.goalSavedValue, c)}, Prazo: ${snapshot.user.goalDeadline || 'Não definido'})
- **Contas conectadas:** ${snapshot.connectedAccountsCount} conta(s) ativa(s)
- **Saldo total agregado:** ${formatCurrency(snapshot.aggregatedBalance, c)}
- **Mês corrente:**
  - Receitas: ${formatCurrency(snapshot.currentMonth.totalIncome, c)}
  - Despesas: ${formatCurrency(snapshot.currentMonth.totalExpense, c)}
  - Poupança líquida: ${formatCurrency(snapshot.currentMonth.netSavings, c)}
  - Taxa de poupança: ${(snapshot.currentMonth.savingsRate * 100).toFixed(1)}%
- **Despesas dos últimos 90 dias por categoria:**
${categoryBreakdown || '- Sem histórico recente.'}
- **Orçamento do mês corrente:**
${budgetBreakdown || '- Sem limites cadastrados.'}
- **Simulação de cenários:**
${scenarioInfo}
`.trim();
}
