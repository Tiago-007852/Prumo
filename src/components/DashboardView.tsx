import React from 'react';
import {
  User,
  Account,
  Transaction,
  BudgetLimit,
  Country,
  Alert,
} from '../types';
import {
  formatCurrency,
  calculateAggregatedBalance,
  calculateTotals,
  analyzeBudgets,
  generatePredictiveAlerts,
} from '../services/businessRules';
import {
  Compass,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  Building2,
  Sparkles,
  Target,
  Clock,
  ShieldAlert,
  WifiOff,
  HardDrive,
} from 'lucide-react';
import { TabKey } from './Navigation';
import { DailySpendingChart } from './DailySpendingChart';
import { AnimatedNumber } from './AnimatedNumber';

interface DashboardViewProps {
  user: User;
  country: Country;
  accounts: Account[];
  transactions: Transaction[];
  budgetLimits: BudgetLimit[];
  onNavigate: (tab: TabKey) => void;
  onOpenNewTransaction: () => void;
  onOpenConnectAccount: () => void;
  isOnline?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  country,
  accounts,
  transactions,
  budgetLimits,
  onNavigate,
  onOpenNewTransaction,
  onOpenConnectAccount,
  isOnline = true,
}) => {
  const aggregatedBalance = calculateAggregatedBalance(accounts);
  const { totalIncome, totalExpense, netSavings, savingsRate } = calculateTotals(transactions);
  const budgets = analyzeBudgets(budgetLimits, transactions);
  const alerts = generatePredictiveAlerts(user.profile, accounts, transactions, budgetLimits);

  // Progresso da Meta Primária
  const goalTarget = user.profile.goalTargetValue || 1;
  const goalSaved = user.profile.goalSavedValue || 0;
  const goalPercentage = Math.min(100, Math.round((goalSaved / goalTarget) * 100));

  // Estimativa de meses restantes baseada na poupança mensal atual
  const remainingGoalValue = Math.max(0, goalTarget - goalSaved);
  const estimatedMonthsToGoal =
    netSavings > 0 ? (remainingGoalValue / netSavings).toFixed(1) : '—';

  return (
    <div id="dashboard-view" className="space-y-6">
      {/* Banner de Modo Offline */}
      {!isOnline && (
        <div
          id="banner-dashboard-offline"
          className="p-4 rounded-xl border border-[var(--warn)]/30 bg-[var(--warn-soft)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-[var(--text)] shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--warn)]/20 flex items-center justify-center text-[var(--warn)] shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-[var(--warn)]">Navegando em Modo Offline:</span>{' '}
              Seus saldos, orçamentos e simulações continuam funcionando normalmente. Todos os dados permanecem salvos com segurança no armazenamento local.
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--warn)] shrink-0 bg-[var(--surface)] px-3 py-1.5 rounded-lg border border-[var(--warn)]/20">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Dados Locais Prontos</span>
          </div>
        </div>
      )}

      {/* Top Banner de Contexto Profissional */}
      <div
        id="profession-context-banner"
        className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              Copiloto Ativo • {country === 'BR' ? 'Brasil' : 'Angola'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--line)]">
              {user.profile.profession}
            </span>
          </div>
          <h1 className="font-serif-display text-xl sm:text-2xl font-bold text-[var(--text)]">
            Painel Financeiro Adaptativo
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-dim)] max-w-2xl">
            Projeções e limites calibrados para o perfil de{' '}
            <strong className="text-[var(--text)]">{user.profile.profession}</strong>, priorizando sua meta de{' '}
            <em>"{user.profile.primaryGoal}"</em>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-quick-new-tx"
            type="button"
            onClick={onOpenNewTransaction}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
          <button
            id="btn-quick-copilot"
            type="button"
            onClick={() => onNavigate('copilot')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--line)]/30 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
            <span>Perguntar à IA</span>
          </button>
        </div>
      </div>

      {/* Empty state: usuário real recém-onboarded, sem dados ainda */}
      {accounts.length === 0 && transactions.length === 0 && (
        <div
          id="dashboard-empty-state"
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-xs"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] mb-4">
            <Compass className="w-7 h-7" />
          </div>
          <h2 className="font-serif-display text-xl font-bold text-[var(--text)]">
            Tudo pronto, {user.name?.split(' ')[0] || 'vamos lá'}! Seus números começam aqui.
          </h2>
          <p className="text-sm text-[var(--text-dim)] max-w-md mx-auto mt-2 leading-relaxed">
            Registre seu primeiro lançamento para o painel ganhar vida — as métricas, alertas e
            projeções refletem <strong className="text-[var(--text)]">apenas os seus dados reais</strong>.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-5">
            <button
              type="button"
              onClick={onOpenNewTransaction}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Registrar primeiro lançamento
            </button>
            <button
              type="button"
              onClick={onOpenConnectAccount}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--line)]/30 transition-colors cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              Adicionar conta
            </button>
            <button
              type="button"
              onClick={() => onNavigate('copilot')}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              Falar com o copiloto
            </button>
          </div>
        </div>
      )}

      {/* Alertas Preditivos (Regra de Negócio) */}
      {alerts.length > 0 && (
        <div id="alerts-container" className="space-y-2">
          {alerts.map((alert) => {
            const isDanger = alert.severity === 'danger';
            const isWarning = alert.severity === 'warning';
            return (
              <div
                key={alert.id}
                id={`alert-item-${alert.id}`}
                className={`rounded-lg p-3.5 flex items-start gap-3 border transition-colors ${
                  isDanger
                    ? 'bg-[var(--danger-soft)] border-[var(--danger)]/30 text-[var(--text)]'
                    : isWarning
                    ? 'bg-[var(--warn-soft)] border-[var(--warn)]/30 text-[var(--text)]'
                    : 'bg-[var(--positive-soft)] border-[var(--positive)]/30 text-[var(--text)]'
                }`}
              >
                {isDanger ? (
                  <ShieldAlert className="w-5 h-5 text-[var(--danger)] shrink-0 mt-0.5" />
                ) : isWarning ? (
                  <AlertTriangle className="w-5 h-5 text-[var(--warn)] shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[var(--positive)] shrink-0 mt-0.5" />
                )}
                <div className="flex-1 text-xs sm:text-sm">
                  <div className="font-semibold text-[var(--text)]">{alert.title}</div>
                  <div className="text-[var(--text-dim)] mt-0.5 leading-relaxed">{alert.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('copilot')}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline whitespace-nowrap self-center"
                >
                  Ver no Copiloto →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 4 Cards de Métricas Principais (Fraunces Display Typography) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Agregado */}
        <div
          id="metric-aggregated-balance"
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-dim)] mb-2">
            <span>Saldo Total Agregado</span>
            <Wallet className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="font-serif-display text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">
            <AnimatedNumber value={aggregatedBalance} country={country} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-dim)]">
            <span>{accounts.length} contas ({accounts.filter((a) => a.provider === 'open_finance').length} Open Finance)</span>
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="text-[var(--accent)] hover:underline font-medium"
            >
              Gerenciar
            </button>
          </div>
        </div>

        {/* Receitas do Mês */}
        <div
          id="metric-month-income"
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-dim)] mb-2">
            <span>Receitas do Mês</span>
            <TrendingUp className="w-4 h-4 text-[var(--positive)]" />
          </div>
          <div className="font-serif-display text-2xl sm:text-3xl font-bold text-[var(--positive)] tracking-tight">
            <AnimatedNumber value={totalIncome} country={country} />
          </div>
          <div className="mt-2 text-xs text-[var(--text-dim)]">
            Expectativa mensal: {formatCurrency(user.profile.monthlyIncomeExpectation, country)}
          </div>
        </div>

        {/* Despesas do Mês */}
        <div
          id="metric-month-expense"
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-dim)] mb-2">
            <span>Despesas do Mês</span>
            <TrendingDown className="w-4 h-4 text-[var(--danger)]" />
          </div>
          <div className="font-serif-display text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">
            <AnimatedNumber value={totalExpense} country={country} />
          </div>
          <div className="mt-2 text-xs text-[var(--text-dim)]">
            Saldo líquido: <strong className={netSavings >= 0 ? 'text-[var(--positive)]' : 'text-[var(--danger)]'}>{formatCurrency(netSavings, country)}</strong>
          </div>
        </div>

        {/* Taxa de Poupança */}
        <div
          id="metric-savings-rate"
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-dim)] mb-2">
            <span>Taxa de Poupança</span>
            <PiggyBank className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="font-serif-display text-2xl sm:text-3xl font-bold text-[var(--accent)] tracking-tight">
            {(savingsRate * 100).toFixed(1)}%
          </div>
          <div className="mt-2 text-xs">
            {savingsRate >= 0.3 ? (
              <span className="text-[var(--positive)] font-medium">Excelente ritmo de aportes</span>
            ) : savingsRate >= 0.15 ? (
              <span className="text-[var(--warn)] font-medium">Ritmo moderado (meta: &gt; 20%)</span>
            ) : (
              <span className="text-[var(--danger)] font-medium">Abaixo da margem segura</span>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de Tendência de Gastos Diários (30 Dias) via Recharts */}
      <DailySpendingChart transactions={transactions} country={country} />

      {/* Grid Central: Meta Primária + Resumo de Orçamento por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Meta Primária de Vida */}
        <div
          id="primary-goal-card"
          className="lg:col-span-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                  Meta Principal
                </span>
              </div>
              <span className="text-xs text-[var(--text-dim)] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Prazo: {user.profile.goalDeadline}
              </span>
            </div>

            <h3 className="font-serif-display text-lg font-bold text-[var(--text)] leading-snug">
              {user.profile.primaryGoal}
            </h3>

            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-dim)]">Guardado:</span>
                <span className="font-semibold text-[var(--text)]">
                  {formatCurrency(goalSaved, country)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-dim)]">Valor Alvo:</span>
                <span className="font-semibold text-[var(--text)]">
                  {formatCurrency(goalTarget, country)}
                </span>
              </div>
              {/* Barra de Progresso */}
              <div className="w-full bg-[var(--surface-2)] h-2.5 rounded-full overflow-hidden mt-2 border border-[var(--line)]">
                <div
                  className="bg-[var(--accent)] h-full transition-all duration-500 rounded-full"
                  style={{ width: `${goalPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[var(--text-dim)] pt-1">
                <span>{goalPercentage}% concluído</span>
                <span>Restam {formatCurrency(remainingGoalValue, country)}</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--text-dim)] leading-relaxed">
              No ritmo de poupança atual ({formatCurrency(netSavings, country)}/mês), a conclusão estimada é de aproximadamente{' '}
              <strong className="text-[var(--text)]">{estimatedMonthsToGoal} meses</strong>.
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="w-full py-2 text-xs font-semibold text-[var(--accent)] hover:underline flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Gerenciar Metas & Aportes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Resumo dos Orçamentos por Categoria */}
        <div
          id="category-budgets-card"
          className="lg:col-span-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif-display text-lg font-bold text-[var(--text)]">
                Status dos Orçamentos do Mês
              </h3>
              <p className="text-xs text-[var(--text-dim)]">
                Monitoramento por categoria com limites adaptados
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              Editar Limites →
            </button>
          </div>

          <div className="space-y-3.5">
            {budgets.map((b) => {
              const isExceeded = b.status === 'exceeded';
              const isWarning = b.status === 'warning';
              const barColor = isExceeded
                ? 'bg-[var(--danger)]'
                : isWarning
                ? 'bg-[var(--warn)]'
                : 'bg-[var(--positive)]';

              return (
                <div key={b.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text)]">{b.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-dim)]">
                        {formatCurrency(b.spent, country)} / {formatCurrency(b.monthlyLimit, country)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          isExceeded
                            ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                            : isWarning
                            ? 'bg-[var(--warn-soft)] text-[var(--warn)]'
                            : 'bg-[var(--positive-soft)] text-[var(--positive)]'
                        }`}
                      >
                        {isExceeded ? 'Estourado' : isWarning ? 'Atenção' : 'Dentro'} ({b.percentage}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-[var(--surface-2)] h-2 rounded-full overflow-hidden border border-[var(--line)]">
                    <div
                      className={`${barColor} h-full transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.min(100, b.percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Destaque para Simulação de Cenários */}
          <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--accent-soft)]/40 p-3.5 rounded-lg border border-[var(--accent)]/20">
            <div className="text-xs">
              <span className="font-semibold text-[var(--text)]">Simulador de 24 Meses Disponível:</span>
              <p className="text-[var(--text-dim)] mt-0.5">
                Teste o impacto de novos clientes, corte de custos ou compra de equipamentos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('scenarios')}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shadow-xs cursor-pointer"
            >
              Abrir Projeção →
            </button>
          </div>
        </div>
      </div>

      {/* Seção Inferior: Últimas Transações + Atalhos */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-serif-display text-lg font-bold text-[var(--text)]">
              Últimos Lançamentos
            </h3>
            <p className="text-xs text-[var(--text-dim)]">
              Transações manuais e importadas via Open Finance
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            Ver todos ({transactions.length}) →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[var(--text-dim)] border-b border-[var(--line)] bg-[var(--surface-2)]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Data</th>
                <th className="py-2.5 px-3 font-semibold">Descrição</th>
                <th className="py-2.5 px-3 font-semibold">Categoria</th>
                <th className="py-2.5 px-3 font-semibold">Origem</th>
                <th className="py-2.5 px-3 font-semibold text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {transactions.slice(0, 5).map((t) => {
                const isIncome = t.type === 'income';
                return (
                  <tr key={t.id} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td className="py-2.5 px-3 text-[var(--text-dim)] whitespace-nowrap">
                      {t.occurredAt}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[var(--text)]">
                      <div>{t.description}</div>
                      {t.merchant && (
                        <div className="text-[10px] text-[var(--text-dim)]">{t.merchant}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--line)]">
                        {t.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] text-[var(--text-dim)]">
                        {t.source === 'auto_import'
                          ? 'Open Finance'
                          : t.source === 'ai_categorized'
                          ? 'IA Classificada'
                          : 'Manual'}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${
                        isIncome ? 'text-[var(--positive)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {isIncome ? '+' : '-'} {formatCurrency(Math.abs(t.amount), country)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
