/**
 * Relatório Mensal Imprimível (Fase 1 — Feature 4).
 *
 * Gera um resumo executivo do mês (totais, despesas por categoria, orçamentos,
 * lançamentos) pronto para imprimir ou salvar como PDF (Ctrl+P → "Salvar como
 * PDF"). 100% client-side: nenhum dado sai do dispositivo.
 */

import React from 'react';
import { Account, BudgetLimit, Country, Transaction, User } from '../types';
import {
  analyzeBudgets,
  calculateTotals,
  formatCurrency,
  getMonthKey,
  getCurrentMonthKey,
} from '../services/businessRules';
import { X, Printer } from 'lucide-react';

interface MonthlyReportModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
  country: Country;
  accounts: Account[];
  transactions: Transaction[];
  budgetLimits: BudgetLimit[];
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({
  open,
  onClose,
  user,
  country,
  accounts,
  transactions,
  budgetLimits,
}) => {
  if (!open) return null;

  const monthKey = getCurrentMonthKey();
  const [year, month] = monthKey.split('-').map(Number);
  const monthName = `${MONTH_NAMES[month - 1]} de ${year}`;

  const monthTx = transactions.filter((t) => getMonthKey(t.occurredAt) === monthKey);
  const { totalIncome, totalExpense, netSavings, savingsRate } = calculateTotals(transactions, { monthKey });
  const budgets = analyzeBudgets(budgetLimits, transactions, { monthKey });

  // Despesas por categoria do mês
  const byCategory: Record<string, number> = {};
  for (const t of monthTx) {
    if (t.type === 'expense') {
      byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount);
    }
  }
  const categoryRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCategory = categoryRows[0]?.[1] ?? 1;

  const accountOf = (id?: string | null) => accounts.find((a) => a.id === id);

  const sortedTx = [...monthTx].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm print:bg-white print:static print:block print:p-0">
      <div className="print-area bg-[var(--surface)] print:bg-white rounded-2xl border border-[var(--line)] print:border-0 shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Barra de ações (não sai na impressão) */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--line)] print:hidden no-print">
          <h3 className="font-serif-display font-bold text-base text-[var(--text)]">Relatório mensal — {monthName}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-dim)] cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo imprimível */}
        <div className="overflow-y-auto p-5 sm:p-7 space-y-6 text-[var(--text)]">
          {/* Cabeçalho do relatório */}
          <div className="flex items-start justify-between border-b-2 border-[var(--accent)] pb-4">
            <div>
              <div className="font-serif-display text-2xl font-bold">Prumo</div>
              <div className="text-sm font-semibold">Relatório Financeiro Mensal — {monthName}</div>
              <div className="text-xs text-[var(--text-dim)] mt-0.5">
                {user.name}
                {user.profile.profession ? ` • ${user.profile.profession}` : ''} • {country === 'BR' ? 'Brasil (BRL)' : 'Angola (AOA)'}
              </div>
            </div>
            <div className="text-right text-[11px] text-[var(--text-dim)]">
              Gerado em {new Date().toLocaleDateString(country === 'BR' ? 'pt-BR' : 'pt-AO')}
              <br />
              {monthTx.length} lançamento(s)
            </div>
          </div>

          {/* Resumo executivo */}
          <div>
            <h4 className="text-xs uppercase font-bold tracking-wide text-[var(--text-dim)] mb-2">Resumo do mês</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-semibold text-[var(--text-dim)]">Receitas</div>
                <div className="font-serif-display text-base font-bold text-[var(--positive)]">{formatCurrency(totalIncome, country)}</div>
              </div>
              <div className="rounded-lg border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-semibold text-[var(--text-dim)]">Despesas</div>
                <div className="font-serif-display text-base font-bold text-[var(--danger)]">{formatCurrency(totalExpense, country)}</div>
              </div>
              <div className="rounded-lg border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-semibold text-[var(--text-dim)]">Resultado</div>
                <div className={`font-serif-display text-base font-bold ${netSavings >= 0 ? 'text-[var(--positive)]' : 'text-[var(--danger)]'}`}>
                  {formatCurrency(netSavings, country)}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-semibold text-[var(--text-dim)]">Taxa de poupança</div>
                <div className="font-serif-display text-base font-bold">{(savingsRate * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Despesas por categoria */}
          {categoryRows.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-bold tracking-wide text-[var(--text-dim)] mb-2">Despesas por categoria</h4>
              <div className="space-y-2">
                {categoryRows.map(([cat, val]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-40 sm:w-52 text-xs font-medium truncate">{cat}</div>
                    <div className="flex-1 h-3 rounded bg-[var(--surface-2)] overflow-hidden print:bg-gray-100">
                      <div
                        className="h-full rounded bg-[var(--accent)] print:bg-gray-700"
                        style={{ width: `${Math.max((val / maxCategory) * 100, 2)}%` }}
                      />
                    </div>
                    <div className="w-28 text-right text-xs font-semibold whitespace-nowrap">{formatCurrency(val, country)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orçamentos */}
          {budgets.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-bold tracking-wide text-[var(--text-dim)] mb-2">Orçamentos</h4>
              <table className="w-full text-xs">
                <thead className="text-[var(--text-dim)] border-b border-[var(--line)] uppercase text-[10px]">
                  <tr>
                    <th className="py-1.5 text-left">Categoria</th>
                    <th className="py-1.5 text-right">Gasto</th>
                    <th className="py-1.5 text-right">Limite</th>
                    <th className="py-1.5 text-right">Uso</th>
                    <th className="py-1.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {budgets.map((b) => (
                    <tr key={b.category}>
                      <td className="py-1.5 font-medium">{b.category}</td>
                      <td className="py-1.5 text-right">{formatCurrency(b.spent, country)}</td>
                      <td className="py-1.5 text-right text-[var(--text-dim)]">{formatCurrency(b.monthlyLimit, country)}</td>
                      <td className="py-1.5 text-right">{b.percentage}%</td>
                      <td
                        className={`py-1.5 text-right font-semibold ${
                          b.status === 'exceeded' ? 'text-[var(--danger)]' : b.status === 'warning' ? 'text-[var(--warn)]' : 'text-[var(--positive)]'
                        }`}
                      >
                        {b.status === 'exceeded' ? 'Excedido' : b.status === 'warning' ? 'Atenção' : 'OK'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Lançamentos do mês */}
          <div>
            <h4 className="text-xs uppercase font-bold tracking-wide text-[var(--text-dim)] mb-2">
              Lançamentos ({monthTx.length})
            </h4>
            {sortedTx.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)]">Nenhum lançamento neste mês.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-[var(--text-dim)] border-b border-[var(--line)] uppercase text-[10px]">
                  <tr>
                    <th className="py-1.5 text-left">Data</th>
                    <th className="py-1.5 text-left">Descrição</th>
                    <th className="py-1.5 text-left">Categoria</th>
                    <th className="py-1.5 text-left">Conta</th>
                    <th className="py-1.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {sortedTx.map((t) => {
                    const acc = accountOf(t.accountId);
                    return (
                      <tr key={t.id}>
                        <td className="py-1.5 whitespace-nowrap text-[var(--text-dim)]">{t.occurredAt.split('-').reverse().join('/')}</td>
                        <td className="py-1.5 font-medium max-w-[200px] truncate">
                          {t.description}
                          {t.installments ? ` (${t.installments.current}/${t.installments.total})` : ''}
                        </td>
                        <td className="py-1.5 text-[var(--text-dim)]">{t.category}</td>
                        <td className="py-1.5 text-[var(--text-dim)]">{acc ? acc.institutionName : '—'}</td>
                        <td className={`py-1.5 text-right font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-[var(--positive)]' : ''}`}>
                          {t.type === 'income' ? '+' : '−'} {formatCurrency(Math.abs(t.amount), country)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Rodapé do relatório */}
          <div className="border-t border-[var(--line)] pt-3 text-[10px] text-[var(--text-dim)] leading-relaxed">
            Relatório gerado pelo Prumo — copiloto financeiro para Brasil e Angola. Este documento é uma
            compilação informativa dos dados registrados pelo usuário e não constitui aconselhamento
            financeiro, de investimento, jurídico ou tributário.
          </div>
        </div>
      </div>
    </div>
  );
};
