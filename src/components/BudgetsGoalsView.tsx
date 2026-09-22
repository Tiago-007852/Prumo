import React, { useState } from 'react';
import { BudgetLimit, Transaction, Country, User, Goal, StandardCategory } from '../types';
import { formatCurrency, analyzeBudgets } from '../services/businessRules';
import { Target, Plus, Edit2, Check, AlertTriangle, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';

interface BudgetsGoalsViewProps {
  user: User;
  budgetLimits: BudgetLimit[];
  transactions: Transaction[];
  country: Country;
  goals: Goal[];
  onUpdateBudgetLimit: (id: string, newLimit: number) => void;
  onAddBudgetLimit: (category: string, monthlyLimit: number) => void;
  onAddSavedAmountToPrimaryGoal: (amount: number) => void;
  onAddGoal: (goal: Omit<Goal, 'id'>) => void;
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
  onUpdateBudgetLimit,
  onAddBudgetLimit,
  onAddSavedAmountToPrimaryGoal,
  onAddGoal,
}) => {
  const budgets = analyzeBudgets(budgetLimits, transactions);

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
    if (newGoalLabel && !isNaN(val) && val > 0) {
      onAddGoal({
        userId: user.id,
        label: newGoalLabel,
        targetValue: val,
        savedValue: 0,
        targetDate: newGoalDate,
      });
      setNewGoalLabel('');
      setNewGoalTarget('');
      setShowAddGoal(false);
    }
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
              Objetivos calibrados com o copiloto para o seu plano de carreira
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
                  <span className="text-xs text-[var(--text-dim)]">Prazo: {g.targetDate}</span>
                </div>

                <h3 className="font-serif-display text-lg font-bold text-[var(--text)] mb-3">{g.label}</h3>

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

      {/* SEÇÃO 2: ORÇAMENTO POR CATEGORIA */}
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
