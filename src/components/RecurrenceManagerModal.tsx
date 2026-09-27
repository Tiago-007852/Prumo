/**
 * Modal de Lançamentos Recorrentes (Fase 1 — Feature 2).
 * CRUD de regras que o motor materializa em transações reais todo mês
 * (aluguel, salário, assinaturas), com toggle de pausa e preview de próximos.
 */

import React, { useState } from 'react';
import { Account, Country, RecurrenceFrequency, RecurrenceRule, TransactionType } from '../types';
import { formatCurrency } from '../services/businessRules';
import { Repeat, X, Trash2, Plus, Pause, Play } from 'lucide-react';

interface RecurrenceManagerModalProps {
  open: boolean;
  onClose: () => void;
  rules: RecurrenceRule[];
  accounts: Account[];
  country: Country;
  onAddRule: (rule: Omit<RecurrenceRule, 'id' | 'createdAt'>) => void;
  onToggleRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
}

const CATEGORIES = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer & Cultura',
  'Serviços & Assinaturas',
  'Impostos & Tarifas',
  'Salário / Honorários',
  'Rendimento / Investimento',
  'Outros',
];

export const RecurrenceManagerModal: React.FC<RecurrenceManagerModalProps> = ({
  open,
  onClose,
  rules,
  accounts,
  country,
  onAddRule,
  onToggleRule,
  onDeleteRule,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('Moradia');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('5');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!desc.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Informe descrição e valor maiores que zero.');
      return;
    }
    setError(null);
    onAddRule({
      userId: 'current-user',
      description: desc.trim(),
      amount: parsedAmount,
      type,
      category,
      frequency,
      dayOfMonth: frequency === 'monthly' ? Math.min(Math.max(parseInt(dayOfMonth, 10) || 1, 1), 31) : undefined,
      startDate,
      accountId: accountId || null,
      active: true,
    });
    // Reset
    setDesc('');
    setAmount('');
    setShowForm(false);
  };

  const freqLabel: Record<RecurrenceFrequency, string> = {
    weekly: 'Semanal',
    monthly: 'Mensal',
    yearly: 'Anual',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
              <Repeat className="w-4.5 h-4.5 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="font-serif-display font-bold text-base text-[var(--text)]">Lançamentos recorrentes</h3>
              <p className="text-[11px] text-[var(--text-dim)]">Aluguel, salário, assinaturas — lançados automaticamente no dia certo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-dim)] cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Formulário de nova regra */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-[var(--text-dim)]">Descrição</label>
                  <input
                    type="text"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Ex: Aluguel / Salário / Netflix"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    required
                  />
                </div>

                {/* Tipo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-dim)]">Tipo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        type === 'expense'
                          ? 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/40'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]'
                      }`}
                    >
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        type === 'income'
                          ? 'bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]/40'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)]'
                      }`}
                    >
                      Receita
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-dim)]">Valor ({country === 'BR' ? 'R$' : 'Kz'})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-dim)]">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-dim)]">Frequência</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="weekly">Semanal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>

                {frequency === 'monthly' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-dim)]">Dia do mês</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-dim)]">Primeira ocorrência</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-[var(--text-dim)]">Conta (opcional)</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">Sem conta específica</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.institutionName} ({a.kind})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p className="text-xs text-[var(--danger)] font-medium">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--line)] text-[var(--text-dim)] hover:bg-[var(--surface)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer"
                >
                  Criar recorrência
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full py-2.5 rounded-lg border border-dashed border-[var(--line)] text-xs font-semibold text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Nova recorrência
            </button>
          )}

          {/* Lista de regras */}
          <div className="space-y-2">
            {rules.length === 0 && !showForm ? (
              <p className="text-center text-xs text-[var(--text-dim)] py-4">
                Nenhuma recorrência ainda. Crie uma para automatizar seus lançamentos fixos.
              </p>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text)]">{rule.description}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)] text-[var(--text-dim)]">
                        {freqLabel[rule.frequency]}
                        {rule.frequency === 'monthly' && rule.dayOfMonth ? ` • dia ${rule.dayOfMonth}` : ''}
                      </span>
                      {!rule.active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--warn-soft)] text-[var(--warn)] font-semibold">Pausada</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                      {rule.type === 'income' ? 'Receita' : 'Despesa'} • {rule.category}
                      {rule.endDate ? ` • até ${rule.endDate}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`font-serif-display text-sm font-bold whitespace-nowrap ${
                        rule.type === 'income' ? 'text-[var(--positive)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {rule.type === 'income' ? '+' : '−'} {formatCurrency(rule.amount, country)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleRule(rule.id)}
                      title={rule.active ? 'Pausar' : 'Retomar'}
                      className="p-1.5 rounded text-[var(--text-dim)] hover:bg-[var(--surface)] hover:text-[var(--text)] cursor-pointer"
                    >
                      {rule.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRule(rule.id)}
                      title="Excluir regra (as transações já lançadas permanecem)"
                      className="p-1.5 rounded text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
