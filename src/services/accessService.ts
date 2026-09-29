/**
 * Serviço de acesso (paywall Fase 5) — frontend.
 *
 * - `fetchAccess`: lê hasAccess/accessUntil do /api/auth/me (mesma chamada
 *   que já valida a sessão — zero custo extra de rede).
 * - `confirmPayment`: pós-redirect do Stripe, valida a sessão no servidor
 *   via POST /api/sync { action:'payment_confirm', sessionId }.
 * - `activateWithCode`: vendas manuais (Angola), via POST /api/sync
 *   { action:'activate_code', code }.
 */

export interface AccessInfo {
  hasAccess: boolean;
  accessUntil: string | null;
  stripeConfigured: boolean;
  priceConfigured: boolean;
}

export async function fetchAccess(): Promise<AccessInfo | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.access as AccessInfo) || null;
  } catch {
    return null;
  }
}

/** Lê a flag isAdmin do /me (mostrar a tab Admin no Navigation). */
export async function fetchIsAdmin(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.isAdmin);
  } catch {
    return false;
  }
}

async function postSyncAction(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; configured?: boolean; accessUntil?: string }> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error || 'Falha na operação', configured: data?.configured };
  }
  return { ok: true, accessUntil: data?.accessUntil };
}

export async function confirmPayment(sessionId: string): Promise<{ ok: boolean; error?: string; configured?: boolean; accessUntil?: string }> {
  return postSyncAction({ action: 'payment_confirm', sessionId });
}

/** Pede ao servidor uma Checkout Session vinculada à conta e devolve a URL. */
export async function startCheckout(): Promise<{ ok: boolean; url?: string; error?: string; configured?: boolean }> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'checkout_start' }),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error || 'Falha ao iniciar checkout', configured: data?.configured };
  }
  return { ok: true, url: data?.url };
}

export async function activateWithCode(code: string): Promise<{ ok: boolean; error?: string; configured?: boolean; accessUntil?: string }> {
  return postSyncAction({ action: 'activate_code', code });
}
