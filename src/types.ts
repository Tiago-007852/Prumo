/**
 * Modelos de dados do Prumo (conforme Seção 4 do Brief do Projeto)
 */

export type Country = 'BR' | 'AO';

export interface UserProfile {
  profession: string;
  primaryGoal: string;
  goalTargetValue: number;
  goalSavedValue: number;
  goalDeadline: string; // YYYY-MM
  monthlyIncomeExpectation: number;
  experienceLevel?: 'iniciante' | 'intermediario' | 'avancado';
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
export type TransactionSource = 'auto_import' | 'manual' | 'ai_categorized';

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

export type AlertType = 'budget_warning' | 'budget_exceeded' | 'emergency_fund' | 'irregular_income' | 'goal_progress';

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
