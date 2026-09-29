import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  KeyRound,
  History,
  Loader2,
  Copy,
  Check,
  Search,
  ShieldCheck,
  CalendarClock,
} from 'lucide-react';
import { AccessInfo } from '../services/accessService';

/* ─── Tipos espelham api/_lib/admin.ts ─── */

interface AdminKpis {
  usersTotal: number;
  usersNew7d: number;
  usersActive: number;
  usersBr: number;
  usersAo: number;
  codesAlive: number;
  codesUsed: number;
  mrrEstimateBrl: number;
}

interface AdminCodeRow {
  code: string;
  days: number;
  note: string | null;
  status: 'novo' | 'usado';
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  country: 'BR' | 'AO';
  hasAccess: boolean;
  accessUntil: string | null;
  createdAt: string;
  lastSyncAt: string | null;
}

interface AdminAuditRow {
  id: number;
  adminEmail: string;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

/* ─── Cliente das actions (POST /api/sync { action:'admin_*' }) ─── */

async function adminApi<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Falha na operação admin');
  return (data?.data ?? data) as T;
}

/* ─── Componente ─── */

type Section = 'overview' | 'codes' | 'users' | 'audit';

export const AdminView: React.FC<{ onToast?: (msg: string) => void }> = ({ onToast }) => {
  const [section, setSection] = useState<Section>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Overview
  const [kpis, setKpis] = useState<AdminKpis | null>(null);

  // Codes
  const [codes, setCodes] = useState<AdminCodeRow[]>([]);
  const [genCount, setGenCount] = useState('10');
  const [genDays, setGenDays] = useState('31');
  const [genNote, setGenNote] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Users
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [expiring, setExpiring] = useState<AdminUserRow[]>([]);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  // Audit
  const [audit, setAudit] = useState<AdminAuditRow[]>([]);

  const load = useCallback(async (s: Section) => {
    setLoading(true);
    setError(null);
    try {
      if (s === 'overview') setKpis(await adminApi<AdminKpis>('admin_kpis'));
      if (s === 'codes') setCodes(await adminApi<AdminCodeRow[]>('admin_codes_list', { limit: 50 }));
      if (s === 'users') {
        setUsers(await adminApi<AdminUserRow[]>('admin_users_search', { query, limit: 20 }));
        setExpiring(await adminApi<AdminUserRow[]>('admin_users_expiring', { days: 7 }));
      }
      if (s === 'audit') setAudit(await adminApi<AdminAuditRow[]>('admin_audit', { limit: 30 }));
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load(section);
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    setGenBusy(true);
    setError(null);
    try {
      const created = await adminApi<string[]>('admin_codes_generate', {
        count: Number(genCount),
        days: Number(genDays),
        note: genNote || undefined,
      });
      onToast?.(`${created.length} código(s) gerado(s)`);
      setGenNote('');
      await load('codes');
    } catch (e: any) {
      setError(e?.message || 'Falha ao gerar');
    } finally {
      setGenBusy(false);
    }
  };

  const handleCopyAll = () => {
    const alive = codes.filter((c) => c.status === 'novo').map((c) => c.code).join('\n');
    navigator.clipboard?.writeText(alive).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExtend = async (userId: string, days: number) => {
    setBusyUser(userId);
    setError(null);
    try {
      await adminApi('admin_user_extend', { userId, days });
      onToast?.(`Acesso estendido em ${days} dias`);
      await load('users');
    } catch (e: any) {
      setError(e?.message || 'Falha ao estender');
    } finally {
      setBusyUser(null);
    }
  };

  const handleRevoke = async (userId: string) => {
    setBusyUser(userId);
    setError(null);
    try {
      await adminApi('admin_user_revoke', { userId });
      onToast?.('Acesso revogado');
      await load('users');
    } catch (e: any) {
      setError(e?.message || 'Falha ao revogar');
    } finally {
      setBusyUser(null);
    }
  };

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

  const tabs: Array<{ key: Section; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'overview', label: 'Visão Geral', icon: ShieldCheck },
    { key: 'codes', label: 'Códigos', icon: KeyRound },
    { key: 'users', label: 'Utilizadores', icon: Users },
    { key: 'audit', label: 'Auditoria', icon: History },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setSection(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                section === t.key
                  ? 'bg-[var(--accent)] text-white dark:text-[#0B0E14]'
                  : 'bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] p-3 text-sm text-[var(--text)]">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10 text-[var(--text-dim)]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {/* ─── Visão Geral ─── */}
      {!loading && section === 'overview' && kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Utilizadores', value: kpis.usersTotal, sub: `+${kpis.usersNew7d} nos últimos 7 dias` },
            { label: 'Com acesso ativo', value: kpis.usersActive, sub: `${kpis.usersBr} BR · ${kpis.usersAo} AO` },
            { label: 'Códigos vivos', value: kpis.codesAlive, sub: `${kpis.codesUsed} já usados` },
            { label: 'MRR estimado', value: `R$ ${kpis.mrrEstimateBrl.toFixed(2)}`, sub: 'ativos × R$ 29,90' },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{k.label}</div>
              <div className="font-serif-display text-2xl font-bold mt-1">{k.value}</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-1">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Códigos ─── */}
      {!loading && section === 'codes' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="font-semibold text-sm mb-3">Gerar novo lote</div>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Quantidade</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={genCount}
                  onChange={(e) => setGenCount(e.target.value)}
                  className="w-20 px-2.5 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Dias</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={genDays}
                  onChange={(e) => setGenDays(e.target.value)}
                  className="w-20 px-2.5 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)]"
                />
              </label>
              <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Nota (opcional)</span>
                <input
                  value={genNote}
                  onChange={(e) => setGenNote(e.target.value)}
                  placeholder="Ex.: Revendedor Kudi"
                  className="px-2.5 py-2 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)]"
                />
              </label>
              <button
                onClick={handleGenerate}
                disabled={genBusy}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white dark:text-[#0B0E14] text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                {genBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Gerar
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex items-center justify-between p-3 border-b border-[var(--line)]">
              <span className="text-sm font-semibold">Últimos 50 códigos</span>
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text)] underline underline-offset-4"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[var(--positive)]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar vivos'}
              </button>
            </div>
            <div className="divide-y divide-[var(--line)] max-h-96 overflow-y-auto">
              {codes.length === 0 && <div className="p-4 text-sm text-[var(--text-dim)]">Nenhum código ainda.</div>}
              {codes.map((c) => (
                <div key={c.code} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="font-mono text-xs">{c.code}</span>
                  <span className="text-[10px] text-[var(--text-dim)]">{c.days}d</span>
                  {c.note && <span className="text-[10px] text-[var(--text-dim)] truncate">· {c.note}</span>}
                  <span className="ml-auto">
                    {c.status === 'novo' ? (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--positive-soft)] text-[var(--positive)] text-[10px] font-semibold">novo</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] text-[10px] font-semibold">
                        usado {c.usedBy ? `· ${c.usedBy.slice(0, 10)}…` : ''} {c.usedAt ? `· ${fmtDate(c.usedAt)}` : ''}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Utilizadores ─── */}
      {!loading && section === 'users' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load('users')}
                placeholder="Buscar por email ou nome…"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)]"
              />
            </div>
            <button
              onClick={() => load('users')}
              className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white dark:text-[#0B0E14] text-sm font-semibold"
            >
              Buscar
            </button>
          </div>

          {/* Expirando em breve */}
          {expiring.length > 0 && (
            <div className="rounded-xl border border-[var(--warn)]/30 bg-[var(--warn-soft)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                <CalendarClock className="w-4 h-4" />
                Expiram nos próximos 7 dias ({expiring.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {expiring.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 text-sm">
                    <span className="truncate">{u.email}</span>
                    <span className="text-[var(--text-dim)] text-xs">até {fmtDate(u.accessUntil)}</span>
                    <button
                      onClick={() => handleExtend(u.id, 31)}
                      disabled={busyUser === u.id}
                      className="ml-auto text-xs underline underline-offset-4 hover:text-[var(--text)]"
                    >
                      +31 dias
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--line)]">
            {users.length === 0 && <div className="p-4 text-sm text-[var(--text-dim)]">Nenhum utilizador encontrado.</div>}
            {users.map((u) => (
              <div key={u.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{u.name || u.email}</div>
                  <div className="text-xs text-[var(--text-dim)] truncate">
                    {u.email} · {u.country} · sync: {fmtDate(u.lastSyncAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      u.hasAccess
                        ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                        : 'bg-[var(--danger-soft)] text-[var(--danger)]'
                    }`}
                  >
                    {u.hasAccess ? `ativo${u.accessUntil ? ` até ${fmtDate(u.accessUntil)}` : ' (ilimitado)'}` : 'sem acesso'}
                  </span>
                  <button
                    onClick={() => handleExtend(u.id, 31)}
                    disabled={busyUser === u.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--surface-2)]"
                  >
                    +31d
                  </button>
                  <button
                    onClick={() => handleRevoke(u.id)}
                    disabled={busyUser === u.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                  >
                    Revogar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Auditoria ─── */}
      {!loading && section === 'audit' && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--line)]">
          {audit.length === 0 && <div className="p-4 text-sm text-[var(--text-dim)]">Sem ações registadas.</div>}
          {audit.map((a) => (
            <div key={a.id} className="p-3 flex items-center gap-3 text-sm">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--surface-2)]">{a.action}</span>
              <span className="text-xs text-[var(--text-dim)] truncate">{JSON.stringify(a.detail)}</span>
              <span className="ml-auto text-xs text-[var(--text-dim)] whitespace-nowrap">
                {a.adminEmail.split('@')[0]} · {fmtDate(a.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
