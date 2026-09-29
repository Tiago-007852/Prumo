/**
 * Regras puras de acesso (paywall — Fase 5).
 *
 * Sem I/O e sem env: usadas pelo servidor (api/_lib/payments.ts) e pelos
 * testes — o mesmo padrão de src/services/pluggyMapping.ts (Fase 4).
 */

/** Formato de Checkout Session do Stripe: cs_test_... / cs_live_... */
export function isValidCheckoutSessionId(id: unknown): boolean {
  return /^cs_(test|live)_[A-Za-z0-9]+$/.test(String(id || '').trim());
}

export interface AccessRowLike {
  hasAccess: boolean | null | undefined;
  accessUntil: string | null | undefined;
}

/**
 * Um usuário pode entrar no app?
 *  - hasAccess explicitamente false → bloqueado (contas novas nascem assim);
 *  - accessUntil no futuro → liberado (assinatura vigente);
 *  - sem accessUntil → o has_access manda (grandfathered/manuais).
 */
export function evaluateAccess(row: AccessRowLike, now: Date = new Date()): boolean {
  if (row.hasAccess === false) return false;
  if (!row.accessUntil) return true;
  return new Date(row.accessUntil).getTime() > now.getTime();
}
