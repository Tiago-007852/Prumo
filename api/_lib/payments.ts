/**
 * Pagamentos — Stripe (Fase 5).
 *
 * Fluxo (sem novas serverless — estamos no limite de 12 do Hobby):
 *   1. A oferta aponta direto para um Payment Link do Stripe (criado no
 *      dashboard, com client_reference_id = userId na URL) → zero chamada à
 *      nossa API para iniciar o checkout.
 *   2. Após pagar, o Stripe redireciona para /?pagamento=ok&session_id=...
 *      → o frontend chama POST /api/sync { action:'payment_confirm', ... }
 *      → o servidor VALIDA a sessão diretamente na API do Stripe (nunca
 *      confia no redirect) e grava users.has_access = true com
 *      access_until = fim do período pago.
 *   3. Cada carregamento do app checa se access_until ainda está no futuro;
 *      renovar = novo pagamento (o Stripe cobra recorrente e a sessão mais
 *      recente estende a data).
 *
 * Env vars (Vercel): STRIPE_SECRET_KEY + STRIPE_PAYMENT_LINK_URL (config
 * não-secreta usada pelo frontend via /api/auth/me). Sem STRIPE_SECRET_KEY o
 * endpoint responde 501 configured:false — degradação graciosa, igual ao
 * padrão do Pluggy na Fase 4.
 */

import { getSql, ensureSchema } from './db';
import {
  isValidCheckoutSessionId,
  evaluateAccess,
  normalizeActivationCode,
  isValidActivationCodeFormat,
} from '../../src/services/accessRules';

export { isValidCheckoutSessionId, evaluateAccess };

const STRIPE_API = 'https://api.stripe.com';

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Payment Link configurado no dashboard (não-secreto; vai ao /api/auth/me). */
export function getPaymentLinkUrl(): string | null {
  return process.env.STRIPE_PAYMENT_LINK_URL || null;
}

/** Price recorrente do Stripe (price_... em BRL) para checkout server-side. */
export function isPriceConfigured(): boolean {
  return Boolean(process.env.STRIPE_PRICE_ID);
}

interface StripeSession {
  id: string;
  status: string;
  payment_status: string;
  client_reference_id: string | null;
  subscription?: string | null;
  current_period_end?: number | null;
  customer?: string | null;
}

/**
 * Consulta uma Checkout Session do Stripe (REST puro — sem SDK, para manter o
 * bundle serverless enxuto igual ao padrão do pluggy.ts).
 */
async function stripeGet(path: string): Promise<unknown> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe não configurado');
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Stripe ${path} falhou (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Extrai o fim do período atual de uma assinatura (unix seconds). */
async function subscriptionPeriodEnd(subscriptionId: string): Promise<number | null> {
  try {
    const sub = (await stripeGet(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`)) as {
      current_period_end?: number;
    };
    return sub?.current_period_end ?? null;
  } catch {
    return null;
  }
}

export interface PaymentConfirmResult {
  accessUntil: string | null;
  recurring: boolean;
}

/**
 * Valida uma sessão de checkout e ativa o acesso do usuário.
 * Regras de segurança:
 *   - a sessão precisa estar payment_status = 'paid';
 *   - client_reference_id (quando presente) precisa bater com o usuário logado;
 *   - idempotente: reprocessar a mesma session_id não estende o acesso.
 */
export async function confirmPayment(userId: string, sessionId: string): Promise<PaymentConfirmResult> {
  if (!isStripeConfigured()) {
    throw Object.assign(new Error('Pagamentos não configurados no servidor'), { code: 'not_configured' });
  }
  const cleanId = String(sessionId || '').trim();
  if (!isValidCheckoutSessionId(cleanId)) {
    throw new Error('session_id inválido');
  }

  const session = (await stripeGet(`/v1/checkout/sessions/${encodeURIComponent(cleanId)}`)) as StripeSession;
  if (!session || session.status !== 'complete' || session.payment_status !== 'paid') {
    throw new Error('Pagamento ainda não confirmado pelo Stripe');
  }

  const sessionUserId = session.client_reference_id ? String(session.client_reference_id) : null;
  if (sessionUserId && sessionUserId !== userId) {
    throw new Error('Sessão de pagamento pertence a outra conta');
  }

  // Fim do período: assinatura → current_period_end da assinatura; pagamento
  // único → +31 dias (margem sobre 30 para evitar corrida de renovação).
  let periodEndMs: number;
  if (session.subscription) {
    const subEnd = await subscriptionPeriodEnd(String(session.subscription));
    periodEndMs = subEnd ? subEnd * 1000 : Date.now() + 31 * 24 * 60 * 60 * 1000;
  } else {
    periodEndMs = Date.now() + 31 * 24 * 60 * 60 * 1000;
  }
  const accessUntil = new Date(periodEndMs).toISOString();

  await grantAccess(userId, {
    accessUntil,
    stripeCustomerId: session.customer ? String(session.customer) : null,
    stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
    lastSessionId: session.id,
  });

  return { accessUntil, recurring: Boolean(session.subscription) };
}

/**
 * Cria uma Checkout Session server-side vinculada ao usuário
 * (client_reference_id = userId) — mais seguro que Payment Link estático,
 * que não permite amarrar a sessão paga à conta.
 */
export async function createCheckoutSession(userId: string): Promise<{ url: string; sessionId: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!key || !priceId) {
    throw Object.assign(new Error('Checkout indisponível — configure STRIPE_SECRET_KEY e STRIPE_PRICE_ID'), {
      code: 'not_configured',
    });
  }

  const origin = process.env.PUBLIC_APP_URL || 'https://prumo-premium.vercel.app';
  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    client_reference_id: userId,
    success_url: `${origin}/?pagamento=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?pagamento=cancelado`,
    // Stripe coleta e atualiza o endereço automaticamente (fatura/recibo)
    'subscription_data[metadata][userId]': userId,
  });

  const res = await fetch(`${STRIPE_API}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Falha ao criar checkout (${res.status}): ${errBody.slice(0, 200)}`);
  }
  const session = (await res.json()) as { id: string; url: string };
  if (!session?.url) throw new Error('Stripe não devolveu URL de checkout');
  return { url: session.url, sessionId: session.id };
}

export interface AccessInfo {
  hasAccess: boolean;
  accessUntil: string | null;
  stripeConfigured: boolean;
  priceConfigured: boolean;
}

/** Lê/normaliza o acesso de um usuário (grandfathering: coluna ausente → true). */
export async function getAccess(userId: string): Promise<AccessInfo> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT has_access, access_until FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (rows.length === 0) {
    return { hasAccess: false, accessUntil: null, stripeConfigured: isStripeConfigured(), priceConfigured: isPriceConfigured() };
  }
  const row = rows[0] as { has_access: boolean | null; access_until: string | Date | null };
  const until = row.access_until ? new Date(row.access_until).toISOString() : null;
  const hasAccess = evaluateAccess({ hasAccess: row.has_access, accessUntil: until });
  return { hasAccess, accessUntil: until, stripeConfigured: isStripeConfigured(), priceConfigured: isPriceConfigured() };
}

/** Concede (ou estende) o acesso, com idempotência por última sessão. */
async function grantAccess(
  userId: string,
  info: { accessUntil: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null; lastSessionId: string }
): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  // Idempotência: se a última sessão confirmada é a mesma, não estende nada.
  const existing = await sql`SELECT access_until, last_session_id FROM users WHERE id = ${userId} LIMIT 1`;
  if (existing.length > 0) {
    const row = existing[0] as { access_until: string | Date | null; last_session_id: string | null };
    if (row.last_session_id === info.lastSessionId) return;
  }

  await sql`
    UPDATE users
    SET has_access = true,
        access_until = ${info.accessUntil},
        stripe_customer_id = COALESCE(${info.stripeCustomerId}, stripe_customer_id),
        stripe_subscription_id = COALESCE(${info.stripeSubscriptionId}, stripe_subscription_id),
        last_session_id = ${info.lastSessionId}
    WHERE id = ${userId}
  `;
}

/** Revoga o acesso (uso interno: cancelamento manual/estorno). */
export async function revokeAccess(userId: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`UPDATE users SET has_access = false WHERE id = ${userId}`;
}

/**
 * Migração idempotente: adiciona as colunas de acesso a users.
 * Usuários pré-paywall ficam grandfathered (has_access = true).
 * Roda no primeiro acesso de cada instância (cacheado, igual ao ensureSchema).
 */
let _paymentsSchemaReady: Promise<void> | null = null;

export function ensurePaymentsSchema(): Promise<void> {
  if (!_paymentsSchemaReady) {
    _paymentsSchemaReady = (async () => {
      const sql = getSql();
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_access BOOLEAN NOT NULL DEFAULT true`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS access_until TIMESTAMPTZ`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_session_id TEXT`;
    })().catch((err) => {
      _paymentsSchemaReady = null;
      throw err;
    });
  }
  return _paymentsSchemaReady;
}

/* ─── Códigos de ativação single-use (Fase 5) ───
 * Tabela activation_codes: códigos PRUMO-XXXX-XXXX-XXXX gerados pelo
 * scripts/generate-codes.mjs, de utilização única (claim atômico) — ideal
 * para vendas manuais em Angola e revendedores. O ACCESS_CODE do env continua
 * a funcionar como fallback (código universal) quando definido.
 */

export interface ActivationCodeRow {
  code: string;
  days: number;
  note: string | null;
  status: 'novo' | 'usado';
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

/** Migração idempotente da tabela de códigos (cacheada por instância). */
let _codesSchemaReady: Promise<void> | null = null;

export function ensureCodesSchema(): Promise<void> {
  if (!_codesSchemaReady) {
    _codesSchemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS activation_codes (
          code       TEXT PRIMARY KEY,
          days       INTEGER NOT NULL DEFAULT 31,
          note       TEXT,
          status     TEXT NOT NULL DEFAULT 'novo',
          used_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
          used_at    TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      _codesSchemaReady = null;
      throw err;
    });
  }
  return _codesSchemaReady;
}

/**
 * Ativação por código de utilização única (com fallback ao ACCESS_CODE do
 * env, código universal, para compatibilidade com o modo de arranque).
 * Claim atômico: UPDATE ... WHERE status='novo' — duas pessoas a usar o
 * mesmo código ao mesmo tempo só uma consegue.
 */
export async function activateWithCode(userId: string, code: string): Promise<string> {
  const normalized = normalizeActivationCode(code);
  await ensureSchema();
  await ensureCodesSchema();
  const sql = getSql();

  // 1. Código single-use da tabela
  if (isValidActivationCodeFormat(normalized)) {
    const found = await sql`SELECT code, days, status FROM activation_codes WHERE code = ${normalized} LIMIT 1`;
    if (found.length > 0) {
      const row = found[0] as { code: string; days: number; status: string };
      if (row.status !== 'novo') {
        throw new Error('Este código já foi utilizado');
      }
      // Claim atômico: só passa se ainda estiver 'novo'
      const claimed = await sql`
        UPDATE activation_codes
        SET status = 'usado', used_by = ${userId}, used_at = now()
        WHERE code = ${normalized} AND status = 'novo'
        RETURNING days
      `;
      if (claimed.length === 0) {
        throw new Error('Este código já foi utilizado');
      }
      const days = Number((claimed[0] as { days: number }).days) || 31;
      const singleUseUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      await grantAccess(userId, {
        accessUntil: singleUseUntil,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        lastSessionId: `code_${normalized}`,
      });
      return singleUseUntil;
    }
    // Formato certo mas não existe na tabela → cai no fallback (abaixo)
  }

  // 2. Fallback: código universal do env (modo de arranque)
  const expected = process.env.ACCESS_CODE;
  if (!expected) {
    throw new Error('Código de ativação inválido');
  }
  if (normalized !== normalizeActivationCode(expected)) {
    throw new Error('Código de ativação inválido');
  }
  const fallbackUntil = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
  await grantAccess(userId, {
    accessUntil: fallbackUntil,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    lastSessionId: `manual_${Date.now()}`,
  });
  return fallbackUntil;
}

/** Lista códigos para o script de gestão (mais recentes primeiro). */
export async function listActivationCodes(limit = 50): Promise<ActivationCodeRow[]> {
  await ensureCodesSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT code, days, note, status, used_by, used_at, created_at
    FROM activation_codes ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows as unknown as ActivationCodeRow[];
}

/** Insere um lote de códigos (usado pelo scripts/generate-codes.mjs). */
export async function insertActivationCodes(codes: Array<{ code: string; days: number; note?: string }>): Promise<void> {
  await ensureSchema();
  await ensureCodesSchema();
  const sql = getSql();
  for (const c of codes) {
    await sql`
      INSERT INTO activation_codes (code, days, note)
      VALUES (${c.code}, ${c.days}, ${c.note || null})
      ON CONFLICT (code) DO NOTHING
    `;
  }
}
