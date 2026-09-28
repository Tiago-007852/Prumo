/**
 * Modelos de dados do Prumo (conforme Seção 4 do Brief do Projeto)
 */

export type Country = 'BR' | 'AO';

export type IncomeType = 'fixa' | 'variavel' | 'mista';

export type GoalType =
  | 'reserva'
  | 'quitar_divida'
  | 'casa'
  | 'carro'
  | 'educacao'
  | 'negocio'
  | 'outra'
  | 'nenhuma';

export interface UserProfile {
  profession: string;
  primaryGoal: string;
  goalTargetValue: number;
  goalSavedValue: number;
  goalDeadline: string; // YYYY-MM
  monthlyIncomeExpectation: number;
  experienceLevel?: 'iniciante' | 'intermediario' | 'avancado';
  /** Tipo de renda informado no onboarding (calibra alertas de reserva). */
  incomeType?: IncomeType;
  /** Tipo da meta principal (personaliza o copiloto e sugestões). */
  goalType?: GoalType;
}

export interface User {
  id: string;
  name: string;
  email: string;
  country: Country;
  locale: string;
  createdAt: string;
  profile: UserProfile;
  twoFactorEnabled?: boolean;
  /** false = wizard de onboarding pendente (contas reais recém-criadas). */
  onboardingCompleted?: boolean;
}

export type AccountProvider = 'open_finance' | 'manual';
export type AccountKind = 'checking' | 'savings' | 'investment' | 'credit' | 'digital_wallet';

export interface Account {
  id: string;
  userId: string;
  provider: AccountProvider;
  institutionName: string;
  institutionCode?: string;
  kind: AccountKind;
  balance: number;
  currency: 'BRL' | 'AOA';
  lastSyncedAt: string;
  status: 'connected' | 'syncing' | 'needs_reauth' | 'manual';
  accountNumberMask?: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionSource = 'auto_import' | 'manual' | 'ai_categorized' | 'recurring' | 'ofx_import';

/** Frequência de uma regra de lançamento recorrente. */
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly';

/**
 * Regra de lançamento recorrente (aluguel, salário, assinaturas). O motor
 * materializa as instâncias como transações reais de forma idempotente
 * (marcador `rec:<id>:<YYYY-MM>` nas tags impede duplicatas).
 */
export interface RecurrenceRule {
  id: string;
  userId: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  frequency: RecurrenceFrequency;
  /** Dia do mês (1-31) para 'monthly'; ignorado nos demais. */
  dayOfMonth?: number;
  /** Primeira ocorrência (YYYY-MM-DD). */
  startDate: string;
  /** Data final opcional (YYYY-MM-DD) — após ela a regra para de gerar. */
  endDate?: string;
  accountId?: string | null;
  active: boolean;
  createdAt: string;
}

export type StandardCategory =
  | 'Alimentação'
  | 'Moradia'
  | 'Transporte'
  | 'Educação'
  | 'Saúde'
  | 'Lazer & Cultura'
  | 'Serviços & Assinaturas'
  | 'Equipamentos & Trabalho'
  | 'Impostos & Tarifas'
  | 'Salário / Honorários'
  | 'Rendimento / Investimento'
  | 'Outros';

export interface Transaction {
  id: string;
  userId: string;
  accountId?: string | null;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  source: TransactionSource;
  occurredAt: string; // ISO date YYYY-MM-DD
  createdAt: string;
  merchant?: string;
  tags?: string[];
  /** Parcelamento de cartão: posição atual e total (ex: 2 de 12). */
  installments?: { current: number; total: number; groupId: string } | null;
}

export type BudgetStatus = 'within' | 'warning' | 'exceeded';

export interface BudgetLimit {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
}

export interface BudgetAnalysis {
  category: string;
  monthlyLimit: number;
  spent: number;
  percentage: number;
  remaining: number;
  status: BudgetStatus;
}

export interface Goal {
  id: string;
  userId: string;
  label: string;
  targetValue: number;
  savedValue: number;
  targetDate: string; // YYYY-MM
  category?: string;
  /** Como o aporte mensal da meta é abastecido. */
  funding?: 'manual' | 'auto_from_income';
  /** Valor mensal planejado de aporte (ritmo, Fase 3). */
  monthlyContribution?: number;
}

/**
 * Atribuição mensal de dinheiro a uma categoria (método envelope/YNAB — Fase 3).
 * Cada registro é um "aporte" no envelope da categoria para o mês `monthKey`
 * (YYYY-MM). O saldo disponível da categoria = atribuído no mês + rollover
 * de meses anteriores − gasto do mês.
 */
export interface CategoryAllocation {
  id: string;
  userId: string;
  category: string;
  monthKey: string; // YYYY-MM
  amount: number;
  createdAt: string;
  note?: string;
}

/** Alertas push/in-app (depreciado em favor de Notification) — mantido p/ compat. */
export type NotificationKind =
  | 'budget_warning'
  | 'budget_exceeded'
  | 'emergency_fund'
  | 'irregular_income'
  | 'goal_progress'
  | 'goal_deadline'
  | 'recurrence_upcoming'
  | 'envelope_exhausted'
  | 'shared_space';

/**
 * Notificação/lembrete in-app (Fase 3). As notificações derivadas (orçamento,
 * recorrência, meta) são geradas determinísticas e idempotentes pelo
 * notificationService; os registros aqui marcam leitura e chegada.
 */
export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  triggeredAt: string;
  readAt?: string | null;
  actionTab?: 'overview' | 'transactions' | 'budgets' | 'scenarios' | 'accounts' | 'copilot';
}

/** Papel de um membro num espaço compartilhado (casal/família — Fase 3). */
export type SpaceRole = 'owner' | 'member';

export interface SpaceMember {
  userId: string;
  name: string;
  email: string;
  role: SpaceRole;
  joinedAt: string;
}

/**
 * Espaço compartilhado (casal/família). Os dados financeiros vivem no estado
 * de CADA membro (offline-first); o espaço define quem vê os resumos e
 * sincroniza saldos por e-mail/convite.
 */
export interface SharedSpace {
  id: string;
  name: string;
  ownerUserId: string;
  country: Country;
  inviteCode: string;
  members: SpaceMember[];
  createdAt: string;
  /** Preferências de visibilidade entre membros. */
  settings?: {
    /** 'full' = membros veem valores; 'summary' = só categorias/tendências. */
    detailLevel?: 'full' | 'summary';
  };
}

export interface ScenarioEvent {
  id: string;
  label: string;
  description: string;
  type: 'income' | 'expense';
  monthlyDelta: number; // positive = more money, negative = less money
  oneTimeCost?: number;
  startMonth: number; // 1 to 24
  durationMonths?: number; // 0 or undefined for indefinite
  enabled: boolean;
  category: string;
}

export interface MonthProjection {
  monthIndex: number; // 1 to 24
  monthLabel: string; // "Mês 1 (Out/26)", etc.
  baselineBalance: number;
  scenarioBalance: number;
  deltaNet: number;
  incomeBaseline: number;
  incomeScenario: number;
  expenseBaseline: number;
  expenseScenario: number;
  activeEvents: string[];
}

export interface ScenarioSimulation {
  id: string;
  userId: string;
  name: string;
  params: {
    events: ScenarioEvent[];
    baseMonthlyIncome: number;
    baseMonthlyExpense: number;
    initialBalance: number;
  };
  computedProjection: MonthProjection[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  suggestedAction?: {
    label: string;
    actionType: 'open_scenario' | 'view_budget' | 'add_transaction' | 'check_goal';
  };
}

export type AlertType =
  | 'budget_warning'
  | 'budget_exceeded'
  | 'emergency_fund'
  | 'irregular_income'
  | 'goal_progress'
  | 'goal_deadline';

export interface Alert {
  id: string;
  userId: string;
  type: AlertType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  triggeredAt: string;
  readAt?: string | null;
  actionUrl?: string;
}

export interface FinancialSnapshot {
  user: {
    name: string;
    profession: string;
    country: Country;
    primaryGoal: string;
    goalTargetValue: number;
    goalSavedValue: number;
    goalDeadline: string;
  };
  aggregatedBalance: number;
  connectedAccountsCount: number;
  currentMonth: {
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    savingsRate: number; // 0 to 1
  };
  past90DaysByCategory: Record<string, { income: number; expense: number; count: number }>;
  budgets: BudgetAnalysis[];
  activeScenarioSummary?: {
    enabledEventsCount: number;
    month24Baseline: number;
    month24Scenario: number;
    difference: number;
  };
}
