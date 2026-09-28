import React, { useMemo, useState } from 'react';
import {
  BudgetLimit,
  Transaction,
  Country,
  User,
  Goal,
  StandardCategory,
  CategoryAllocation,
} from '../types';
import {
  formatCurrency,
  analyzeBudgets,
  calculateTotals,
  buildYnabMonthContext,
  suggestAllocationFromHistory,
  computeGoalPace,
} from '../services/businessRules';
import {
  Target,
  Plus,
  Edit2,
  Check,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
  Wand2,
  X,
  Gauge,
} from 'lucide-react';

interface BudgetsGoalsViewProps {
  user: User;
  budgetLimits: BudgetLimit[];
  transactions: Transaction[];
  country: Country;
  goals: Goal[];
  /** Atribuições mensais por categoria (método envelope — Fase 3). */
  categoryAllocations: CategoryAllocation[];
  onUpdateBudgetLimit: (id: string, newLimit: number) => void;
  onAddBudgetLimit: (category: string, monthlyLimit: number) => void;
  onAddSavedAmountToPrimaryGoal: (amount: number) => void;
  onAddGoal: (goal: Omit<Goal, 'id'>) => void;
  /** Adiciona (ou soma) valor ao envelope da categoria no mês corrente. */
  onAllocateToCategory: (category: string, amount: number) => void;
  /** Zera a atribuição do mês para a categoria (devolve ao "Para atribuir"). */
  onClearCategoryAllocation: (category: string) => void;
  /** Aplica um plano completo de atribuições do mês (substitui valores). */
  onAutoAllocateAll: (plan: Array<{ category: string; amount: number }>) => void;
}

const CATEGORIES: StandardCategory[] = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Educação',
  'Saúde',
  'Lazer & Cultura',
  'Serviços & Assinaturas',
  'Equipamentos & Trabalho',
  'Impostos & Tarifas',
  'Salário / Honorários',
  'Rendimento / Investimento',
  'Outros',
];

export const BudgetsGoalsView: React.FC<BudgetsGoalsViewProps> = ({
  user,
  budgetLimits,
  transactions,
  country,
  goals,
  categoryAllocations,
  onUpdateBudgetLimit,
  onAddBudgetLimit,
  onAddSavedAmountToPrimaryGoal,
  onAddGoal,
  onAllocateToCategory,
  onClearCategoryAllocation,
  onAutoAllocateAll,
}) => {
  const budgets = analyzeBudgets(budgetLimits, transactions);
  const { netSavings } = calculateTotals(transactions);

  // ── Envelope (YNAB): contexto do mês corrente ──
  const ynab = useMemo(
    () => buildYnabMonthContext(categoryAllocations, transactions),
    [categoryAllocations, transactions]
  );

  // State para edição rápida de limite
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempLimit, setTempLimit] = useState<string>('');

  // State para adicionar novo orçamento
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState('Saúde');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');

  // State para aporte na meta primária
  const [quickSaveAmount, setQuickSaveAmount] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // State para adicionar nova meta
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalLabel, setNewGoalLabel] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDate, setNewGoalDate] = useState('2027-12');
  const [newGoalCategory, setNewGoalCategory] = useState<string>('Outros');
  const [newGoalMonthly, setNewGoalMonthly] = useState('');

  // State para atribuição por categoria (input inline por categoria)
  const [allocCategory, setAllocCategory] = useState<string | null>(null);
  const [allocAmount, setAllocAmount] = useState('');
  const [autoAllocated, setAutoAllocated] = useState(false);

  const handleStartEdit = (b: BudgetLimit) => {
    setEditingId(b.id);
    setTempLimit(b.monthlyLimit.toString());
  };

  const handleSaveEdit = (id: string) => {
    const val = parseFloat(tempLimit);
    if (!isNaN(val) && val >= 0) {
      onUpdateBudgetLimit(id, val);
    }
    setEditingId(null);
  };

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newBudgetLimit);
    if (!isNaN(val) && val > 0) {
      onAddBudgetLimit(newBudgetCategory, val);
      setNewBudgetLimit('');
      setShowAddBudget(false);
    }
  };

  const handleApplyQuickSave = () => {
    const val = parseFloat(quickSaveAmount);
    if (!isNaN(val) && val > 0) {
      onAddSavedAmountToPrimaryGoal(val);
      setQuickSaveAmount('');
      setShowSaveInput(false);
    }
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newGoalTarget);
    const monthly = parseFloat(newGoalMonthly);
    if (newGoalLabel && !isNaN(val) && val > 0) {
      onAddGoal({
        userId: user.id,
        label: newGoalLabel,
        targetValue: val,
        savedValue: 0,
        targetDate: newGoalDate,
        category: newGoalCategory !== 'Outros' ? newGoalCategory : undefined,
        monthlyContribution: !isNaN(monthly) && monthly > 0 ? monthly : undefined,
        funding: 'manual',
      });
      setNewGoalLabel('');
      setNewGoalTarget('');
      setNewGoalMonthly('');
      setShowAddGoal(false);
    }
  };

  const submitAllocation = (category: string) => {
    const val = parseFloat(allocAmount);
    if (!isNaN(val) && val !== 0) {
      onAllocateToCategory(category, val);
    }
    setAllocCategory(null);
    setAllocAmount('');
  };

  /** Atribuição automática: sugere por histórico (média +10%) ou teto, e escala proporcionalmente ao disponível. */
  const handleAutoAllocate = () => {
    const cats = new Set<string>();
    for (const l of budgetLimits) cats.add(l.category);
    for (const t of transactions) if (t.type === 'expense') cats.add(t.category);

    const suggestions: Array<{ category: string; amount: number }> = [];
    for (const c of cats) {
      const fromHistory = suggestAllocationFromHistory(c, transactions);
      const fromLimit = budgetLimits.find((l) => l.category === c)?.monthlyLimit || 0;
      const amount = fromHistory > 0 ? fromHistory : fromLimit;
      if (amount > 0) suggestions.push({ category: c, amount: Math.round(amount * 100) / 100 });
    }

    const total = suggestions.reduce((s, x) => s + x.amount, 0);
    const budget = Math.max(0, ynab.toAllocate);
    if (total > budget && total > 0) {
      const factor = budget / total;
      for (const s of suggestions) s.amount = Math.floor(s.amount * factor * 100) / 100;
    }

    onAutoAllocateAll(suggestions.filter((s) => s.amount > 0));
    setAutoAllocated(true);
    window.setTimeout(() => setAutoAllocated(false), 3000);
  };

  // Metas combinadas (primária do profile + metas da lista)
  const primaryGoalObj: Goal = {
    id: 'primary-goal',
    userId: user.id,
    label: user.profile.primaryGoal,
    targetValue: user.profile.goalTargetValue,
    savedValue: user.profile.goalSavedValue,
    targetDate: user.profile.goalDeadline,
  };

  const allGoals = [primaryGoalObj, ...goals];

  return (
    <div id="budgets-goals-view" className="space-y-8">
      {/* SEÇÃO 1: METAS FINANCEIRAS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-[var(--text)]">
                Metas & Planejamento de Vida
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-dim)]">
              Objetivos calibrados com o copiloto, com ritmo mensal de aportes
            </p>
          </div>
          <button
            id="btn-toggle-add-goal"
            type="button"
            onClick={() => setShowAddGoal(!showAddGoal)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--line)]/30 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-[var(--accent)]" />
            <span>Adicionar Meta</span>
          </button>
        </div>

        {/* Modal/Form inline para nova meta */}
        {showAddGoal && (
          <form
            onSubmit={handleCreateGoal}
            className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs space-y-3"
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              Nova Meta Financeira
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[var(--text-dim)]">Título da Meta</label>
                <input
                  type="text"
                  value={newGoalLabel}
                  onChange={(e) => setNewGoalLabel(e.target.value)}
                  placeholder="Ex: Intercâmbio, Imóvel, Pós-graduação"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-dim)]">Valor Alvo ({country === 'BR' ? 'R$' : 'Kz'})</label>
                <input
                  type="number"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-dim)]">Prazo Estimado (Ano-Mês)</label>
                <input
                  type="month"
                  value={newGoalDate}
                  onChange={(e) => setNewGoalDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-dim)]">Categoria vinculada (opcional)</label>
                <select
                  value={newGoalCategory}
                  onChange={(e) => setNewGoalCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-dim)]">Aporte mensal planejado (opcional)</label>
                <input
                  type="number"
                  value={newGoalMonthly}
                  onChange={(e) => setNewGoalMonthly(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddGoal(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] text-[var(--text-dim)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white font-semibold"
              >
                Salvar Meta
              </button>
            </div>
          </form>
        )}

        {/* Grid de Metas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allGoals.map((g, idx) => {
            const isPrimary = idx === 0;
            const percentage = Math.min(100, Math.round((g.savedValue / (g.targetValue || 1)) * 100));
            const remaining = Math.max(0, g.targetValue - g.savedValue);
            const pace = computeGoalPace(g, netSavings);
            const paceLabel =
              pace.onTrack === null
                ? 'sem prazo — ritmo livre'
                : pace.onTrack
                ? 'no rumo ✓'
                : 'ritmo abaixo do necessário';

            return (
              <div
                key={g.id}
                className={`rounded-xl p-5 border shadow-xs transition-all ${
                  isPrimary
                    ? 'border-[var(--accent)]/40 bg-[var(--surface)] ring-1 ring-[var(--accent)]/20'
                    : 'border-[var(--line)] bg-[var(--surface)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isPrimary
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-dim)]'
                    }`}
                  >
                    {isPrimary ? 'Meta Principal do Perfil' : 'Meta Complementar'}
                  </span>
                  <span className="text-xs text-[var(--text-dim)]">Prazo: {g.targetDate || '—'}</span>
                </div>

                <h3 className="font-serif-display text-lg font-bold text-[var(--text)] mb-1">{g.label}</h3>
                {g.category && (
                  <span className="inline-block mb-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--line)]">
                    {g.category}
                  </span>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-dim)]">Guardado:</span>
                    <span className="font-semibold text-[var(--text)]">
                      {formatCurrency(g.savedValue, country)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-dim)]">Valor Alvo:</span>
                    <span className="font-semibold text-[var(--text)]">
                      {formatCurrency(g.targetValue, country)}
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="w-full bg-[var(--surface-2)] h-2.5 rounded-full overflow-hidden border border-[var(--line)]">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        percentage >= 100 ? 'bg-[var(--positive)]' : 'bg-[var(--accent)]'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-[var(--text-dim)] pt-1">
                    <span>{percentage}% guardado</span>
                    <span>Faltam {formatCurrency(remaining, country)}</span>
                  </div>

                  {/* Ritmo (Fase 3) */}
                  {remaining > 0 && (
                    <div className="flex items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-[var(--line)]">
                      <span className="flex items-center gap-1 text-[var(--text-dim)]">
                        <Gauge className="w-3 h-3 text-[var(--accent)]" />
                        {pace.requiredMonthly > 0 ? (
                          <>
                            Precisa de{' '}
                            <strong className="text-[var(--text)]">
                              {formatCurrency(pace.requiredMonthly, country)}
                            </strong>{' '}
                            /mês ({pace.monthsRemaining} mês(es))
                          </>
                        ) : (
                          <>{paceLabel}</>
                        )}
                      </span>
                      {pace.onTrack !== null && pace.requiredMonthly > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            pace.onTrack
                              ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                              : 'bg-[var(--warn-soft)] text-[var(--warn)]'
                          }`}
                          title={`Poupança atual: ${formatCurrency(netSavings, country)}/mês`}
                        >
                          {pace.onTrack ? 'No rumo' : 'Acelerar'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {isPrimary && (
                  <div className="mt-4 pt-3 border-t border-[var(--line)]">
                    {!showSaveInput ? (
                      <button
                        type="button"
                        onClick={() => setShowSaveInput(true)}
                        className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Aporte nesta Meta</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={quickSaveAmount}
                          onChange={(e) => setQuickSaveAmount(e.target.value)}
                          placeholder="Valor a somar..."
                          className="w-36 px-2.5 py-1 text-xs rounded border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                        />
                        <button
                          type="button"
                          onClick={handleApplyQuickSave}
                          className="px-2.5 py-1 text-xs rounded bg-[var(--accent)] text-white font-semibold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSaveInput(false)}
                          className="text-xs text-[var(--text-dim)] hover:underline cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 2: ATRIBUIÇÃO POR CATEGORIA (MÉTODO ENVELOPE — Fase 3) */}
      <div className="space-y-4 pt-4 border-t border-[var(--line)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-[var(--text)]">
              Atribuição por Categoria — Método Envelope
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-dim)]">
              Decida para onde vai o dinheiro do mês. O que sobra no envelope rola para o mês seguinte.
            </p>
          </div>
          <button
            id="btn-auto-allocate"
            type="button"
            onClick={handleAutoAllocate}
            disabled={ynab.toAllocate <= 0}
            title={
              ynab.toAllocate <= 0
                ? 'Sem dinheiro a atribuir neste mês'
                : 'Sugere valores com base no seu histórico e limites'
            }
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed self-start sm:self-auto"
          >
            <Wand2 className="w-4 h-4" />
            <span>Atribuir automaticamente</span>
          </button>
        </div>

        {/* Card "Para atribuir" */}
        <div
          id="ynab-to-allocate"
          className={`rounded-xl p-5 border shadow-xs flex items-center justify-between gap-4 ${
            ynab.toAllocate < 0
              ? 'border-[var(--danger)]/40 bg-[var(--danger-soft)]'
              : 'border-[var(--accent)]/30 bg-[var(--accent-soft)]/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center text-[var(--accent)] shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                {ynab.toAllocate < 0 ? 'Atribuído além do recebido' : 'Para atribuir'}
              </div>
              <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                Receitas do mês menos o que você já destinou aos envelopes
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-serif-display text-2xl sm:text-3xl font-bold text-[var(--text)]">
              {formatCurrency(ynab.toAllocate, country)}
            </div>
            {autoAllocated && (
              <span className="text-[10px] font-semibold text-[var(--positive)]">
                ✓ Plano aplicado
              </span>
            )}
          </div>
        </div>

        {/* Envelopes por categoria */}
        {ynab.categories.length === 0 ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center text-xs text-[var(--text-dim)]">
            Registre receitas e despesas (ou defina limites abaixo) para começar a encher os
            envelopes do mês.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ynab.categories.map((c) => {
              const isExceeded = c.status === 'exceeded';
              const isWarning = c.status === 'warning';
              const isUnder = c.status === 'underfunded';
              const isAllocating = allocCategory === c.category;
              const barColor = isExceeded
                ? 'bg-[var(--danger)]'
                : isWarning || isUnder
                ? 'bg-[var(--warn)]'
                : 'bg-[var(--positive)]';

              return (
                <div
                  key={c.category}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[var(--text)]">{c.category}</span>
                    <div className="flex items-center gap-1.5">
                      {c.carriedOver !== 0 && (
                        <span
                          className="text-[10px] text-[var(--text-dim)]"
                          title="Saldo rolado de meses anteriores"
                        >
                          rolou {c.carriedOver > 0 ? '+' : ''}
                          {formatCurrency(c.carriedOver, country)}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isExceeded
                            ? 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30'
                            : isWarning || isUnder
                            ? 'bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/30'
                            : 'bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]/30'
                        }`}
                      >
                        {formatCurrency(c.available, country)} disponível
                      </span>
                    </div>
                  </div>

                  {/* Barra de consumo do envelope */}
                  <div className="w-full bg-[var(--surface-2)] h-2 rounded-full overflow-hidden border border-[var(--line)]">
                    <div
                      className={`${barColor} h-full transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.min(100, c.percentage)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">
                    <span>
                      Gasto: {formatCurrency(c.spent, country)}
                      {c.allocatedThisMonth > 0 && (
                        <>
                          {' '}• atribuído no mês:{' '}
                          <strong className="text-[var(--text)]">
                            {formatCurrency(c.allocatedThisMonth, country)}
                          </strong>
                        </>
                      )}
                    </span>
                    {c.status === 'underfunded' && (
                      <span className="text-[var(--warn)] font-semibold">sem atribuição</span>
                    )}
                  </div>

                  {/* Atribuição inline */}
                  <div className="pt-1.5 border-t border-[var(--line)] flex items-center justify-between gap-2">
                    {!isAllocating ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAllocCategory(c.category);
                            setAllocAmount('');
                          }}
                          className="text-[11px] font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          Atribuir / mover
                        </button>
                        {c.allocatedThisMonth > 0 && (
                          <button
                            type="button"
                            onClick={() => onClearCategoryAllocation(c.category)}
                            className="text-[11px] text-[var(--text-dim)] hover:text-[var(--danger)] flex items-center gap-1 cursor-pointer"
                            title="Zerar atribuição do mês (devolve ao 'Para atribuir')"
                          >
                            <X className="w-3 h-3" />
                            Zerar
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="number"
                          autoFocus
                          value={allocAmount}
                          onChange={(e) => setAllocAmount(e.target.value)}
                          placeholder={`Valor (${country === 'BR' ? 'R$' : 'Kz'})`}
                          className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitAllocation(c.category);
                            if (e.key === 'Escape') setAllocCategory(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => submitAllocation(c.category)}
                          className="p-1 rounded bg-[var(--accent)] text-white cursor-pointer"
                          title="Confirmar atribuição"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllocCategory(null)}
                          className="p-1 rounded border border-[var(--line)] text-[var(--text-dim)] cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEÇÃO 3: LIMITES DE ORÇAMENTO (alertas por teto) */}
      <div className="space-y-4 pt-4 border-t border-[var(--line)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-[var(--text)]">
              Limites de Orçamento Mensal
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-dim)]">
              Controle de consumo com alertas visuais automáticos: Dentro (&lt;80%), Atenção (80-100%), Acima (&gt;100%)
            </p>
          </div>
          <button
            id="btn-add-budget-limit"
            type="button"
            onClick={() => setShowAddBudget(!showAddBudget)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Definir Novo Limite</span>
          </button>
        </div>

        {/* Form para adicionar orçamento */}
        {showAddBudget && (
          <form
            onSubmit={handleCreateBudget}
            className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs space-y-3"
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              Cadastrar Teto Mensal
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-dim)]">Categoria</label>
                <select
                  value={newBudgetCategory}
                  onChange={(e) => setNewBudgetCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-dim)]">Limite Mensal ({country === 'BR' ? 'R$' : 'Kz'})</label>
                <input
                  type="number"
                  value={newBudgetLimit}
                  onChange={(e) => setNewBudgetLimit(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddBudget(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] text-[var(--text-dim)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white font-semibold"
              >
                Salvar Limite
              </button>
            </div>
          </form>
        )}

        {/* Lista de Orçamentos Detalhada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const rawItem = budgetLimits.find((l) => l.category === b.category);
            const isEditing = rawItem && editingId === rawItem.id;
            const isExceeded = b.status === 'exceeded';
            const isWarning = b.status === 'warning';

            const statusLabel = isExceeded ? 'Acima do Limite' : isWarning ? 'Atenção' : 'Dentro do Limite';
            const badgeBg = isExceeded
              ? 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30'
              : isWarning
              ? 'bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/30'
              : 'bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]/30';

            const barColor = isExceeded
              ? 'bg-[var(--danger)]'
              : isWarning
              ? 'bg-[var(--warn)]'
              : 'bg-[var(--positive)]';

            return (
              <div
                key={b.category}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--text)]">{b.category}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeBg}`}>
                      {statusLabel} ({b.percentage}%)
                    </span>
                  </div>

                  {rawItem && !isEditing && (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(rawItem)}
                      className="p-1 text-[var(--text-dim)] hover:text-[var(--text)] rounded cursor-pointer"
                      title="Editar valor limite"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Barra de Progresso do Orçamento */}
                <div className="space-y-1">
                  <div className="w-full bg-[var(--surface-2)] h-3 rounded-full overflow-hidden border border-[var(--line)]">
                    <div
                      className={`${barColor} h-full transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.min(100, b.percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--text-dim)]">
                    <span>Gasto: {formatCurrency(b.spent, country)}</span>
                    <span>
                      {isEditing ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            value={tempLimit}
                            onChange={(e) => setTempLimit(e.target.value)}
                            className="w-20 px-1 py-0.5 text-xs rounded border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(rawItem!.id)}
                            className="p-1 rounded bg-[var(--accent)] text-white"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </span>
                      ) : (
                        <span>Teto: {formatCurrency(b.monthlyLimit, country)}</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-[var(--text-dim)] flex items-center justify-between pt-1 border-t border-[var(--line)]">
                  <span>
                    {isExceeded
                      ? 'Excedido em ' + formatCurrency(b.spent - b.monthlyLimit, country)
                      : 'Margem disponível: ' + formatCurrency(b.remaining, country)}
                  </span>
                  {isWarning && <span className="text-[var(--warn)] font-medium">Consumo acelerado</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
