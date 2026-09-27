/**
 * Modal de Importação de Extrato OFX (Fase 1 — Feature 3).
 *
 * Fluxo: selecionar arquivo .ofx → parser 100% client-side (nenhum dado sai do
 * dispositivo) → preview com categoria sugerida → escolher conta → importar.
 * Duplicatas do mesmo banco são evitadas porque o dedup por FITID já acontece
 * no parser e o usuário confirma antes de importar.
 */

import React, { useRef, useState } from 'react';
import { Account, Country, Transaction } from '../types';
import { parseOfx, ofxToTransactions, OfxParseResult } from '../services/ofxParser';
import { formatCurrency } from '../services/businessRules';
import { FileUp, X, Check, AlertCircle, Loader2 } from 'lucide-react';

interface OfxImportModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  country: Country;
  /** Recebe as transações prontas (sem id/createdAt/userId) e fecha o modal. */
  onImport: (txs: Omit<Transaction, 'id' | 'createdAt' | 'userId'>[]) => void;
}

export const OfxImportModal: React.FC<OfxImportModalProps> = ({ open, onClose, accounts, country, onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<OfxParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [imported, setImported] = useState<number | null>(null);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setError(null);
    setParsed(null);
    setImported(null);
    setIsReading(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseOfx(buffer);
      if ('message' in result) {
        setError(result.message);
      } else {
        setParsed(result);
      }
    } catch (err) {
      console.error('Falha ao ler OFX:', err);
      setError('Não foi possível ler o arquivo. Verifique se é um OFX válido.');
    } finally {
      setIsReading(false);
    }
  };

  const handleConfirm = () => {
    if (!parsed) return;
    const txs = ofxToTransactions(parsed.transactions).map((t) => ({
      ...t,
      accountId: accountId || null,
    }));
    setImported(txs.length);
    onImport(txs);
    // Feedback rápido e fecha
    setTimeout(() => {
      setParsed(null);
      setImported(null);
      onClose();
    }, 700);
  };

  const totalExpenses = parsed?.transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0) ?? 0;
  const totalIncome = parsed?.transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
              <FileUp className="w-4.5 h-4.5 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="font-serif-display font-bold text-base text-[var(--text)]">Importar extrato OFX</h3>
              <p className="text-[11px] text-[var(--text-dim)]">
                Bancos BR (Itaú, Nubank, BB, Inter) e exportações padrão • arquivo não sai do seu dispositivo
              </p>
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
          {imported !== null ? (
            <div className="p-4 rounded-xl border border-[var(--positive)]/30 bg-[var(--positive-soft)] text-sm text-[var(--positive)] font-medium flex items-center gap-2">
              <Check className="w-4 h-4" />
              {imported} lançamento(s) importado(s) com sucesso!
            </div>
          ) : !parsed ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReading}
                className="w-full border-2 border-dashed border-[var(--line)] rounded-xl p-8 flex flex-col items-center gap-3 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 transition-all cursor-pointer disabled:opacity-50"
              >
                {isReading ? (
                  <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
                ) : (
                  <FileUp className="w-8 h-8 text-[var(--text-dim)]" />
                )}
                <span className="text-sm font-semibold text-[var(--text)]">
                  {isReading ? 'Lendo arquivo...' : 'Clique para escolher o arquivo .ofx'}
                </span>
                <span className="text-[11px] text-[var(--text-dim)]">Máximo 5 MB • SGML (OFX 1.x) e XML (OFX 2.x)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,application/x-ofx,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              {error && (
                <div className="p-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] text-xs text-[var(--danger)] font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3 text-center">
                  <div className="text-lg font-serif-display font-bold text-[var(--text)]">{parsed.transactions.length}</div>
                  <div className="text-[10px] uppercase font-semibold text-[var(--text-dim)]">Lançamentos</div>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3 text-center">
                  <div className="text-lg font-serif-display font-bold text-[var(--positive)]">{formatCurrency(totalIncome, country)}</div>
                  <div className="text-[10px] uppercase font-semibold text-[var(--text-dim)]">Receitas</div>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3 text-center">
                  <div className="text-lg font-serif-display font-bold text-[var(--danger)]">{formatCurrency(totalExpenses, country)}</div>
                  <div className="text-[10px] uppercase font-semibold text-[var(--text-dim)]">Despesas</div>
                </div>
              </div>

              {parsed.periodStart && parsed.periodEnd && (
                <p className="text-[11px] text-[var(--text-dim)]">
                  Período do extrato: <strong className="text-[var(--text)]">{parsed.periodStart}</strong> até{' '}
                  <strong className="text-[var(--text)]">{parsed.periodEnd}</strong>
                </p>
              )}

              {parsed.warnings.map((w, i) => (
                <div key={i} className="text-[11px] text-[var(--warn)] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {w}
                </div>
              ))}

              {/* Conta destino */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-dim)]">Vincular à conta (opcional)</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Sem conta específica</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.institutionName} ({a.kind})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview das primeiras transações */}
              <div className="rounded-lg border border-[var(--line)] overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-dim)] uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3 text-left">Data</th>
                      <th className="py-2 px-3 text-left">Descrição</th>
                      <th className="py-2 px-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {parsed.transactions.slice(0, 8).map((t, i) => (
                      <tr key={t.fitId || i}>
                        <td className="py-1.5 px-3 text-[var(--text-dim)] whitespace-nowrap">{t.date}</td>
                        <td className="py-1.5 px-3 text-[var(--text)] max-w-[220px] truncate">{t.description}</td>
                        <td
                          className={`py-1.5 px-3 text-right font-semibold whitespace-nowrap ${
                            t.type === 'income' ? 'text-[var(--positive)]' : 'text-[var(--text)]'
                          }`}
                        >
                          {t.type === 'income' ? '+' : '−'} {formatCurrency(Math.abs(t.amount), country)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.transactions.length > 8 && (
                  <div className="py-1.5 px-3 text-[11px] text-[var(--text-dim)] bg-[var(--surface-2)]">
                    + {parsed.transactions.length - 8} outros lançamentos…
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {parsed && imported === null && (
          <div className="p-4 border-t border-[var(--line)] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setParsed(null)}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--line)] text-[var(--text-dim)] hover:bg-[var(--surface-2)] cursor-pointer"
            >
              Escolher outro arquivo
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Importar {parsed.transactions.length} lançamento(s)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
