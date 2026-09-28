import React, { useState } from 'react';
import { Account, Country, User } from '../types';
import { formatCurrency, formatDate } from '../services/businessRules';
import {
  INSTITUTIONS_REGISTRY,
  InstitutionOption,
  getAccountAggregator,
} from '../services/accountAggregator';
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Plus,
  Lock,
  CheckCircle2,
  ExternalLink,
  Wallet,
  Trash2,
} from 'lucide-react';

interface AccountsViewProps {
  user: User;
  country: Country;
  accounts: Account[];
  onConnectAccount: (account: Account) => void;
  onSyncAccount: (accountId: string) => Promise<void>;
  onDeleteAccount: (accountId: string) => void;
  onToggle2FA: () => void;
  /** Conteúdo extra (ex.: espaço compartilhado — Fase 3) renderizado ao final. */
  children?: React.ReactNode;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  user,
  country,
  accounts,
  onConnectAccount,
  onSyncAccount,
  onDeleteAccount,
  onToggle2FA,
  children,
}) => {
  const is2FAEnabled = user.twoFactorEnabled ?? true;
  const [selectedInst, setSelectedInst] = useState<InstitutionOption | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Form states modal
  const [inputBalance, setInputBalance] = useState('');
  const [accountKind, setAccountKind] = useState<'checking' | 'savings' | 'investment'>('checking');
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Listar bancos do país atual
  const availableInstitutions = INSTITUTIONS_REGISTRY.filter((i) => i.country === country);

  const handleStartConnect = (inst: InstitutionOption) => {
    setSelectedInst(inst);
    setInputBalance(country === 'BR' ? '5400.00' : '450000.00');
    setShowConnectModal(true);
  };

  const handleConfirmConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInst) return;

    setIsAuthorizing(true);
    const aggregator = getAccountAggregator(country);

    try {
      const newAcc = await aggregator.connectAccount(user.id, {
        institutionId: selectedInst.id,
        country,
        initialBalance: parseFloat(inputBalance) || 0,
        accountKind,
      });

      onConnectAccount(newAcc);
      setShowConnectModal(false);
      setSelectedInst(null);
    } catch (err) {
      console.error('Falha ao conectar conta:', err);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await onSyncAccount(id);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div id="accounts-view" className="space-y-6">
      {/* Header & Status 2FA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-[var(--text)]">
              {country === 'BR' ? 'Open Finance & Contas Bancárias' : 'Gestão de Contas & Extratos'}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-dim)]">
            {country === 'BR'
              ? 'Conexão regulada pelo Banco Central do Brasil via interface AccountAggregator'
              : 'Gestão manual e extratos de contas de Angola (BAI, BFA, BIC, Standard Bank)'}
          </p>
        </div>

        {/* 2FA Status Banner / Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              is2FAEnabled
                ? 'bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]/30'
                : 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30'
            }`}
          >
            {is2FAEnabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            <span>{is2FAEnabled ? '2FA Ativo (Obrigatório p/ Bancos)' : '2FA Desativado'}</span>
          </div>
          <button
            type="button"
            onClick={onToggle2FA}
            className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] underline"
          >
            {is2FAEnabled ? 'Desativar' : 'Ativar 2FA'}
          </button>
        </div>
      </div>

      {/* Se 2FA estiver desativado, alertar */}
      {!is2FAEnabled && (
        <div className="p-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--text)] flex items-start gap-3">
          <Lock className="w-5 h-5 text-[var(--danger)] shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <strong className="text-[var(--danger)]">Segurança Obrigatória:</strong> De acordo com a
            política do Prumo (Seção 2 do Brief), o 2FA é mandatório antes de liberar a autorização
            de novas conexões bancárias com agregadores Open Finance.
            <div className="mt-2">
              <button
                type="button"
                onClick={onToggle2FA}
                className="px-3 py-1 rounded bg-[var(--danger)] text-white text-xs font-semibold"
              >
                Habilitar 2FA Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contas Atualmente Conectadas */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <h3 className="font-serif-display text-lg font-bold text-[var(--text)]">
          Contas Vinculadas ({accounts.length})
        </h3>

        {accounts.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-dim)]">
            Nenhuma conta cadastrada. Escolha uma instituição abaixo para conectar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const isSyncing = syncingId === acc.id;
              const isOpenFinance = acc.provider === 'open_finance';

              return (
                <div
                  key={acc.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-[var(--text)]">
                          {acc.institutionName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            isOpenFinance
                              ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                              : 'bg-[var(--surface)] text-[var(--text-dim)] border border-[var(--line)]'
                          }`}
                        >
                          {isOpenFinance ? 'Open Finance' : 'Manual'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                        {acc.kind === 'checking'
                          ? 'Conta Corrente'
                          : acc.kind === 'savings'
                          ? 'Poupança / Reserva'
                          : 'Investimentos'}
                        {' • '}
                        {acc.accountNumberMask || '•••• 0000'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteAccount(acc.id)}
                      className="text-[var(--text-dim)] hover:text-[var(--danger)] p-1 rounded"
                      title="Desvincular conta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <div className="text-[11px] text-[var(--text-dim)]">Saldo Atual</div>
                    <div className="font-serif-display text-xl font-bold text-[var(--text)]">
                      {formatCurrency(acc.balance, country)}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--text-dim)]">
                    <span>Sync: {formatDate(acc.lastSyncedAt, country)}</span>
                    <button
                      type="button"
                      onClick={() => handleSync(acc.id)}
                      disabled={isSyncing}
                      className="text-[var(--accent)] font-semibold hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Catálogo de Instituições para Conexão */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs space-y-4">
        <div>
          <h3 className="font-serif-display text-lg font-bold text-[var(--text)]">
            {country === 'BR' ? 'Instituições Disponíveis no Open Finance' : 'Bancos em Angola (Modo Manual / Extrato)'}
          </h3>
          <p className="text-xs text-[var(--text-dim)]">
            {country === 'BR'
              ? 'Conecte sua conta em poucos segundos com consentimento regulado pelo BACEN.'
              : 'Selecione sua instituição para lançar saldos ou simular importação de extrato.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {availableInstitutions.map((inst) => (
            <button
              key={inst.id}
              type="button"
              onClick={() => handleStartConnect(inst)}
              disabled={!is2FAEnabled}
              className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)] hover:shadow-xs transition-all flex flex-col items-center text-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-xs group-hover:scale-105 transition-transform"
                style={{ backgroundColor: inst.iconBg }}
              >
                {inst.logoText}
              </div>
              <div className="text-xs font-semibold text-[var(--text)] leading-tight line-clamp-2">
                {inst.name}
              </div>
              <span className="text-[10px] text-[var(--text-dim)]">
                {inst.supportsOpenFinance ? 'Open Finance' : 'Manual / Extrato'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Espaço compartilhado / casal (Fase 3) */}
      {children}

      {/* Modal de Conexão com Consentimento Open Finance */}
      {showConnectModal && selectedInst && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect-modal-title"
          tabIndex={-1}
          ref={(node) => {
            if (node) node.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowConnectModal(false);
              setSelectedInst(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center font-bold text-white text-xs"
                  style={{ backgroundColor: selectedInst.iconBg }}
                >
                  {selectedInst.logoText}
                </div>
                <h3
                  id="connect-modal-title"
                  className="font-semibold text-sm text-[var(--text)]"
                >
                  Conectar {selectedInst.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {selectedInst.supportsOpenFinance ? (
              <div className="p-3 rounded-lg bg-[var(--accent-soft)]/50 border border-[var(--accent)]/20 text-xs text-[var(--text)] space-y-1.5 leading-relaxed">
                <div className="font-semibold flex items-center gap-1 text-[var(--accent)]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Consentimento Open Finance Regulado (BACEN)</span>
                </div>
                <p className="text-[var(--text-dim)]">
                  Você está autorizando o <strong>Prumo</strong> a visualizar saldos e extratos
                  estritamente para categorização e projeções. Nenhuma movimentação ou pagamento é
                  permitido.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--text-dim)] space-y-1 leading-relaxed">
                <p>
                  Conexão manual para Angola (Seção 2 do Brief). Defina o saldo da sua conta no{' '}
                  {selectedInst.name}.
                </p>
              </div>
            )}

            <form onSubmit={handleConfirmConnect} className="space-y-3 text-xs">
              <div>
                <label className="text-[var(--text-dim)] font-medium">Tipo da Conta</label>
                <select
                  value={accountKind}
                  onChange={(e) => setAccountKind(e.target.value as any)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                >
                  <option value="checking">Conta Corrente / Ordenado</option>
                  <option value="savings">Conta Poupança / Reserva</option>
                  <option value="investment">Investimentos / Aplicações</option>
                </select>
              </div>

              <div>
                <label className="text-[var(--text-dim)] font-medium">
                  Saldo Inicial na Conta ({country === 'BR' ? 'R$' : 'Kz'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={inputBalance}
                  onChange={(e) => setInputBalance(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)]"
                  required
                />
              </div>

              <div className="pt-3 border-t border-[var(--line)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-[var(--text-dim)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAuthorizing}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white font-semibold disabled:opacity-50"
                >
                  {isAuthorizing ? 'Autorizando...' : 'Confirmar e Conectar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
