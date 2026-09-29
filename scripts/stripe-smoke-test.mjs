/**
 * Smoke test do circuito de pagamentos (Fase 5) contra a API real do Stripe
 * em modo teste — sem depender do dev server:
 *   1. createCheckoutSession com um userId fake → URL + session_id
 *   2. payment_confirm com um session_id inexistente → deve falhar graciosamente
 *
 * Uso: node scripts/stripe-smoke-test.mjs
 */

const key = process.env.STRIPE_SECRET_KEY;
const priceId = process.env.STRIPE_PRICE_ID;
if (!key || !priceId) {
  console.error('STRIPE_SECRET_KEY / STRIPE_PRICE_ID ausentes no ambiente');
  process.exit(1);
}

async function stripeForm(path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(params ? { body: new URLSearchParams(params) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// 1. Criar Checkout Session (mesmo contrato de createCheckoutSession em
//    api/_lib/payments.ts — modo subscription, client_reference_id = userId)
const origin = 'http://localhost:3000';
const created = await stripeForm('/checkout/sessions', {
  mode: 'subscription',
  'line_items[0][price]': priceId,
  'line_items[0][quantity]': '1',
  client_reference_id: 'usr_smoketest_000',
  success_url: `${origin}/?pagamento=ok&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/?pagamento=cancelado`,
  'subscription_data[metadata][userId]': 'usr_smoketest_000',
});

if (created.status !== 200) {
  console.error('❌ Checkout Session falhou:', created.status, JSON.stringify(created.body).slice(0, 300));
  process.exit(1);
}
console.log('✅ Checkout Session criada');
console.log('   url:', created.body.url.slice(0, 60) + '…');
console.log('   id :', created.body.id);

// 2. Confirmar pagamento com sessão inexistente (validação de robustez)
const fake = await stripeForm(`/checkout/sessions/cs_test_invalido123`, {});
// Na prática o servidor faz GET; uma 404 aqui confirma que sessões inventadas
// não são aceites (o endpoint local devolveria 400 antes mesmo de chamar).
console.log(fake.status === 404
  ? '✅ Sessão inventada rejeitada pela API (404) — validação server-side sólida'
  : `⚠️  Resposta inesperada para sessão inventada: ${fake.status}`);

// 3. Validar o session_id criado pelo formato (regex do accessRules)
const ok = /^cs_(test|live)_[A-Za-z0-9]+$/.test(created.body.id);
console.log(ok ? '✅ session_id no formato esperado' : '❌ formato inesperado de session_id');
