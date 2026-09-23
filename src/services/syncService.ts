/**
 * Sync offline-first do Prumo.
 * O LocalStorage continua sendo a fonte da verdade em execução; este serviço
 * espelha o estado para o Neon quando há conexão (push) e o recupera em
 * novos dispositivos (pull).
 */

export type SyncStatus = 'local' | 'synced' | 'pending' | 'error';

export interface SyncResult {
  ok: boolean;
  savedAt?: string;
  serverError?: string;
}

/** Envia o estado local consolidado para o servidor. */
export async function pushState(state: unknown): Promise<SyncResult> {
  try {
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
      credentials: 'same-origin',
    });
    if (res.status === 401) {
      return { ok: false, serverError: 'unauthenticated' };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, serverError: data?.error || 'sync_failed' };
    }
    const data = await res.json();
    return { ok: true, savedAt: data?.savedAt };
  } catch {
    return { ok: false, serverError: 'offline' };
  }
}

/** Busca o estado consolidado do servidor (novos dispositivos / restauro). */
export async function pullState(): Promise<{ state: unknown; updatedAt: string | null } | null> {
  try {
    const res = await fetch('/api/sync/pull', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return { state: data?.state ?? null, updatedAt: data?.updatedAt ?? null };
  } catch {
    return null;
  }
}
