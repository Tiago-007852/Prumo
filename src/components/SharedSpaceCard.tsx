import React, { useEffect, useState, useCallback } from 'react';
import { Country, User } from '../types';
import { formatCurrency } from '../services/businessRules';
import {
  fetchSpace,
  createSpace,
  joinSpaceByCode,
  leaveSpace,
  type SpacePayload,
} from '../services/spaceClient';
import { Users, Copy, Check, LogOut, Crown, Loader2, UserPlus } from 'lucide-react';

interface SharedSpaceCardProps {
  user: User;
  country: Country;
  /** Modo demonstração: sem espaço compartilhado (dados fictícios locais). */
  isDemo?: boolean;
  /** Chamado quando o usuário entra/sai de um espaço (para notificação in-app). */
  onSpaceChanged?: (spaceName: string | null) => void;
}

export const SharedSpaceCard: React.FC<SharedSpaceCardProps> = ({ user, country, isDemo = false, onSpaceChanged }) => {
  const [payload, setPayload] = useState<SpacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  const load = useCallback(async () => {
    if (!isOnline) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchSpace();
      setPayload(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o espaço');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!spaceName.trim() || busy) return;
    setBusy(true);
    try {
      const data = await createSpace(spaceName.trim());
      setPayload(data);
      setShowCreate(false);
      setSpaceName('');
      onSpaceChanged?.(data.space?.name ?? null);
    } catch (err: any) {
      setError(err?.message || 'Falha ao criar espaço');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || busy) return;
    setBusy(true);
    try {
      const data = await joinSpaceByCode(joinCode.trim());
      setPayload(data);
      setShowJoin(false);
      setJoinCode('');
      onSpaceChanged?.(data.space?.name ?? null);
    } catch (err: any) {
      setError(err?.message || 'Falha ao entrar no espaço');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (busy) return;
    const isOwner = payload?.space?.ownerUserId === user.id;
    const confirmed = window.confirm(
      isOwner
        ? 'Você é o dono — encerrar o espaço remove todos os membros. Continuar?'
        : 'Sair do espaço compartilhado?'
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await leaveSpace();
      setPayload({ space: null, summary: [] });
      onSpaceChanged?.(null);
    } catch (err: any) {
      setError(err?.message || 'Falha ao sair do espaço');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = async () => {
    if (!payload?.space) return;
    try {
      await navigator.clipboard.writeText(payload.space.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível: código visível na tela para copiar manualmente
    }
  };

  const space = payload?.space;

  return (
    <div
      id="shared-space-card"
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif-display text-lg font-bold text-[var(--text)] leading-tight">
              Espaço Compartilhado
            </h3>
            <p className="text-xs text-[var(--text-dim)]">
              Finanças a dois: convide seu par e acompanhem os saldos juntos
            </p>
          </div>
        </div>
        {space && (
          <button
            type="button"
            onClick={handleLeave}
            disabled={busy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{space.ownerUserId === user.id ? 'Encerrar' : 'Sair'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-[var(--danger)] bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>A carregar espaço…</span>
        </div>
      ) : !isOnline ? (
        <div className="text-xs text-[var(--text-dim)] py-4 text-center">
          O espaço compartilhado precisa de conexão. Seus dados locais continuam salvos.
        </div>
      ) : space ? (
        <div className="space-y-4">
          {/* Cabeçalho do espaço + código de convite */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
            <div>
              <div className="text-xs font-semibold text-[var(--text)]">{space.name}</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                {space.members.length} membro(s) • seu papel:{' '}
                {space.ownerUserId === user.id ? 'dono' : 'membro'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-xs font-mono font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors cursor-pointer"
              title="Copiar código de convite"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : space.inviteCode}</span>
            </button>
          </div>

          {/* Membros com resumo agregado */}
          <div className="space-y-2">
            {(payload?.summary || []).map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-xs font-bold">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                      {m.name}
                      {m.role === 'owner' && <Crown className="w-3 h-3 text-[var(--accent)]" />}
                      {m.userId === user.id && (
                        <span className="text-[10px] font-medium text-[var(--text-dim)]">(você)</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)]">
                      Gasto do mês: {formatCurrency(m.monthExpense, country)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-[var(--text)] font-serif-display">
                    {formatCurrency(m.balance, country)}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)]">saldo agregado</div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed border-t border-[var(--line)] pt-3">
            Cada membro mantém seus próprios lançamentos e contas (privacidade total — o Prumo
            nunca junta dados sem consentimento). O espaço mostra apenas o resumo de saldos e
            gastos por pessoa.
          </p>
        </div>
      ) : isDemo ? (
        <div className="text-xs text-[var(--text-dim)] py-4 text-center">
          Entre com sua conta para criar um espaço compartilhado (não disponível na demonstração).
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-dim)] leading-relaxed">
            Crie um espaço para o casal/família e compartilhe o código de convite — cada pessoa
            mantém seus dados privados e o painel mostra o resumo de todos.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCreate(!showCreate);
                setShowJoin(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Criar espaço</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowJoin(!showJoin);
                setShowCreate(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--line)]/30 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Entrar com código</span>
            </button>
          </div>

          {showCreate && (
            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] space-y-2">
              <label className="text-xs text-[var(--text-dim)]">Nome do espaço</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  placeholder='Ex: "Casa", "Família Silva"'
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)]"
                  maxLength={60}
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={busy || !spaceName.trim()}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] font-semibold cursor-pointer disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Criar'}
                </button>
              </div>
            </div>
          )}

          {showJoin && (
            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] space-y-2">
              <label className="text-xs text-[var(--text-dim)]">Código de convite (8 caracteres)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ex: K7M2P9XW"
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] font-mono tracking-widest"
                  maxLength={8}
                />
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={busy || joinCode.trim().length < 6}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] font-semibold cursor-pointer disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Entrar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
