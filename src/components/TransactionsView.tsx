import React, { useState } from 'react';
import { Transaction, Account, Country, StandardCategory } from '../types';
import { formatCurrency } from '../services/businessRules';
import { classifyOffline } from '../services/storageService';
import { generateTransactionsCSV, downloadCSV } from '../services/exportService';
import {
  Plus,
  Search,
  Filter,
  Sparkles,
  Trash2,
  Calendar,
  Check,
  Building2,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  WifiOff,
  HardDrive,
  Download,
} from 'lucide-react';

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  country: Country;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (id: string) => void;
  isOnline?: boolean;
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

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  accounts,
  country,
  onAddTransaction,
  onDeleteTransaction,
  isOnline = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formCategory, setFormCategory] = useState<string>('Alimentação');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAccountId, setFormAccountId] = useState(accounts[0]?.id || '');
  const [formMerchant, setFormMerchant] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiTagMessage, setAiTagMessage] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Exportação CSV do histórico financeiro
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const csvContent = generateTransactionsCSV(filteredTransactions, accounts, country);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `prumo_historico_financeiro_${country.toLowerCase()}_${dateStr}.csv`;
    downloadCSV(csvContent, filename);

    setExportNotice(
      `Histórico financeiro baixado com sucesso (${filteredTransactions.length} ${
        filteredTransactions.length === 1 ? 'lançamento exportado' : 'lançamentos exportados'
      })!`
    );
    setTimeout(() => {
      setExportNotice(null);
    }, 4500);
  };

  // Auto categorização por IA
  const handleAiCategorize = async () => {
    if (!formDesc.trim()) return;
    setIsClassifying(true);
    setAiTagMessage(null);
    // Se estiver offline ou sem rede, categorizar localmente via regras determinísticas
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      const offlineResult = classifyOffline(formDesc);
      setFormCategory(offlineResult.category);
      setAiTagMessage(`Classificado offline: ${offlineResult.category} (${Math.round(offlineResult.confidence * 100)}% certeza)`);
      setIsClassifying(false);
      return;
    }

    try {
      const res = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formDesc,
          amount: parseFloat(formAmount) || 0,
          country,
        }),
      });
      const data = await res.json();
      if (data.category) {
        setFormCategory(data.category);
        setAiTagMessage(`IA sugeriu: ${data.category} (${Math.round((data.confidence || 0.9) * 100)}% certeza)`);
      }
    } catch (err) {
      console.warn('Falha na categorização online, usando classificador offline:', err);
      const offlineResult = classifyOffline(formDesc);
      setFormCategory(offlineResult.category);
      setAiTagMessage(`Classificado offline: ${offlineResult.category} (${Math.round(offlineResult.confidence * 100)}% certeza)`);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formAmount.replace(',', '.'));
    if (!formDesc || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Por favor, preencha descrição e valor válido.');
      return;
    }

    onAddTransaction({
      userId: 'current-user',
      accountId: formAccountId || undefined,
      description: formDesc,
      amount: parsedAmount,
      type: formType,
      category: formCategory,
      source: aiTagMessage ? 'ai_categorized' : 'manual',
      occurredAt: formDate,
      merchant: formMerchant || undefined,
    });

    // Reset form
    setFormDesc('');
    setFormAmount('');
    setFormMerchant('');
    setAiTagMessage(null);
    setIsFormOpen(false);
  };

  // Filtragem
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.merchant && t.merchant.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedType === 'all' || t.type === selectedType;
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;

    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div id="transactions-view" className="space-y-6">
      {/* Header & Ação de Novo Lançamento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-[var(--text)]">
            Lançamentos Financeiros
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-dim)]">
            Controle de receitas e despesas com categorização inteligente por IA
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            id="btn-export-csv"
            type="button"
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            title={
              filteredTransactions.length === 0
                ? 'Nenhum lançamento para exportar'
                : `Exportar ${filteredTransactions.length} lançamentos em arquivo CSV para Excel / Google Sheets`
            }
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] text-xs sm:text-sm font-medium hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-[var(--accent)]" />
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">CSV</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-dim)] font-medium">
              {filteredTransactions.length}
            </span>
          </button>

          <button
            id="btn-toggle-add-tx"
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isFormOpen ? 'Fechar Formulário' : 'Novo Lançamento'}</span>
          </button>
        </div>
      </div>

      {/* Notificação de Sucesso na Exportação */}
      {exportNotice && (
        <div
          id="toast-export-csv-success"
          className="p-3.5 rounded-xl border border-[var(--positive)]/30 bg-[var(--positive-soft)] text-xs sm:text-sm text-[var(--positive)] font-medium flex items-center justify-between gap-3 shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-[var(--positive)] hover:opacity-75 text-xs font-semibold px-2 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner de Modo Offline */}
      {!isOnline && (
        <div
          id="banner-transactions-offline"
          className="p-3.5 rounded-xl border border-[var(--warn)]/30 bg-[var(--warn-soft)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--text)] shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-[var(--warn)] shrink-0" />
            <div>
              <span className="font-semibold text-[var(--warn)]">Modo Offline Ativo:</span>{' '}
              Seus lançamentos manuais continuam sendo registrados e salvos diretamente no LocalStorage do seu dispositivo.
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--warn)] shrink-0 bg-[var(--surface)] px-2.5 py-1 rounded-md border border-[var(--warn)]/20">
            <HardDrive className="w-3 h-3" />
            <span>Persistência Local Ativa</span>
          </div>
        </div>
      )}

      {/* Formulário de Novo Lançamento (Colapsável) */}
      {isFormOpen && (
        <form
          id="form-new-transaction"
          onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <h3 className="font-semibold text-sm text-[var(--text)]">
              Adicionar Novo Lançamento Manual
            </h3>
            <span className="text-xs text-[var(--text-dim)]">
              Compatível com moedas {country === 'BR' ? 'BRL (R$)' : 'AOA (Kz)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tipo (Receita vs Despesa) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-dim)]">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormType('expense')}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    formType === 'expense'
                      ? 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/40 font-bold'
                      : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-dim)]'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Despesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('income')}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    formType === 'income'
                      ? 'bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]/40 font-bold'
                      : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-dim)]'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Receita</span>
                </button>
              </div>
            </div>

            {/* Descrição com botão de IA */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--text-dim)]">Descrição</label>
                <button
                  type="button"
                  onClick={handleAiCategorize}
                  disabled={!formDesc.trim() || isClassifying}
                  className="text-[11px] font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  title="Detectar categoria automaticamente com IA"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isClassifying ? 'Classificando...' : 'Classificar com IA'}</span>
                </button>
              </div>
              <input
                id="input-tx-description"
                type="text"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Ex: Supermercado Kero / Uber / Pix Consultoria"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                required
              />
              {aiTagMessage && (
                <div className="text-[11px] text-[var(--accent)] font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{aiTagMessage}</span>
                </div>
              )}
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-dim)]">
                Valor ({country === 'BR' ? 'R$' : 'Kz'})
              </label>
              <input
                id="input-tx-amount"
                type="number"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                required
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-dim)]">Categoria</label>
              <select
                id="select-tx-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-dim)]">Data</label>
              <input
                id="input-tx-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Conta */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-dim)]">Conta</label>
              <select
                id="select-tx-account"
                value={formAccountId}
                onChange={(e) => setFormAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">Sem conta específica</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.institutionName} ({a.kind})
                  </option>
                ))}
              </select>
            </div>

            {/* Estabelecimento / Cliente */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-dim)]">Estabelecimento (Opcional)</label>
              <input
                id="input-tx-merchant"
                type="text"
                value={formMerchant}
                onChange={(e) => setFormMerchant(e.target.value)}
                placeholder="Ex: Empresa Parceira, Padaria Central"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--line)] text-[var(--text-dim)] hover:bg-[var(--surface-2)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="btn-submit-tx"
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 shadow-xs cursor-pointer"
            >
              Salvar Lançamento
            </button>
          </div>
        </form>
      )}

      {/* Barra de Filtros e Busca */}
      <div
        id="filters-bar"
        className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between"
      >
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-dim)]" />
          <input
            id="input-search-tx"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar lançamentos ou categorias..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Tipo Filtros */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex p-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs font-medium">
            <button
              type="button"
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1 rounded transition-colors ${
                selectedType === 'all'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('income')}
              className={`px-3 py-1 rounded transition-colors ${
                selectedType === 'income'
                  ? 'bg-[var(--positive-soft)] text-[var(--positive)] shadow-xs font-semibold'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              Receitas
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('expense')}
              className={`px-3 py-1 rounded transition-colors ${
                selectedType === 'expense'
                  ? 'bg-[var(--danger-soft)] text-[var(--danger)] shadow-xs font-semibold'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              Despesas
            </button>
          </div>

          {/* Categoria Select */}
          <select
            id="filter-category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none"
          >
            <option value="all">Todas as Categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[var(--text-dim)] border-b border-[var(--line)] bg-[var(--surface-2)] uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Descrição & Origem</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Conta</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--text-dim)]">
                    Nenhum lançamento encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const isIncome = t.type === 'income';
                  const account = accounts.find((a) => a.id === t.accountId);

                  return (
                    <tr key={t.id} className="hover:bg-[var(--surface-2)]/50 transition-colors">
                      <td className="py-3 px-4 text-[var(--text-dim)] whitespace-nowrap">
                        {t.occurredAt}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--text)]">{t.description}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-dim)]">
                          {t.merchant && <span>{t.merchant}</span>}
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {t.source === 'auto_import' ? (
                              <span className="text-[var(--accent)] font-medium">Open Finance</span>
                            ) : t.source === 'ai_categorized' ? (
                              <span className="text-[var(--accent)] font-medium flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" /> IA
                              </span>
                            ) : (
                              <span>Manual</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] bg-[var(--surface-2)] text-[var(--text)] border border-[var(--line)]">
                          {t.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-dim)] whitespace-nowrap">
                        {account ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-[var(--text-dim)]" />
                            <span>{account.institutionName}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-serif-display text-sm font-bold whitespace-nowrap ${
                          isIncome ? 'text-[var(--positive)]' : 'text-[var(--text)]'
                        }`}
                      >
                        {isIncome ? '+' : '-'} {formatCurrency(Math.abs(t.amount), country)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(t.id)}
                          className="p-1.5 text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] rounded transition-colors cursor-pointer"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
