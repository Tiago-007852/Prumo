/**
 * Cria (idempotentemente) o Produto "Prumo Premium" e o Preço recorrente
 * mensal no Stripe usando STRIPE_SECRET_KEY do ambiente. Nunca imprime a
 * secret key — apenas o price_... resultante e as env vars a configurar.
 *
 * Uso:
 *   node scripts/stripe-provision.mjs            # modo teste (sk_test_)
 *   STRIPE_PRICE_ID=price_... node scripts/...   # re-execução: valida e sai
 *
 * Paridade de preço: 4.900 Kz/mês (AO) ≈ R$ 29,90/mês (BR).
 */

const API = 'https://api.stripe.com/v1';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('❌ STRIPE_SECRET_KEY não definida no ambiente.');
  process.exit(1);
}
const mode = key.startsWith('sk_live_') ? 'LIVE' : 'TEST';
console.log(`🔑 Chave detetada: modo ${mode}`);

async function stripeFetch(path, params) {
  const res = await fetch(`${API}${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(params ? { body: new URLSearchParams(params) } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Stripe ${path} → ${res.status}: ${body?.error?.message || JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

async function main() {
  // 0. Re-execução com price existente: valida que o preço existe e é recorrente.
  const existingPrice = process.env.STRIPE_PRICE_ID;
  if (existingPrice) {
    const p = await stripeFetch(`/prices/${existingPrice}`);
    console.log(`✅ STRIPE_PRICE_ID existente válido: ${p.id} (${(p.unit_amount / 100).toFixed(2)} ${p.currency.toUpperCase()} / ${p.recurring?.interval || '?'})`);
    return;
  }

  // 1. Procura produto existente por listagem + nome (a busca全文 indexa com
  // atraso e a listagem evita duplicados em re-execuções seguidas)
  const listed = await stripeFetch('/products?limit=50&active=true');
  const matches = (listed.data || []).filter((p) => p.name === 'Prumo Premium');
  let product = matches[0];

  // Desativa duplicados de execuções anteriores
  for (const dup of matches.slice(1)) {
    await stripeFetch(`/products/${dup.id}`, { active: 'false' });
    console.log(`🧹 Duplicado desativado: ${dup.id}`);
  }

  if (product) {
    console.log(`ℹ️  Produto já existe: ${product.id} (${product.name})`);
  } else {
    product = await stripeFetch('/products', {
      name: 'Prumo Premium',
      description: 'Copiloto financeiro pessoal — acesso completo (painel, lançamentos, orçamentos, metas, copiloto IA, relatórios).',
      'metadata[product]': 'prumo_premium',
    });
    console.log(`✅ Produto criado: ${product.id}`);
  }

  // 2. Procura preço recorrente BRL 29,90 já existente neste produto
  // (a API de listagem não aceita filtro por currency — filtramos aqui)
  const prices = await stripeFetch(`/prices?product=${product.id}&limit=50`);
  let price = prices.data.find(
    (p) => p.currency === 'brl' && p.unit_amount === 2990 && p.recurring?.interval === 'month' && p.type === 'recurring'
  );

  if (price) {
    console.log(`✅ Preço recorrente já existe: ${price.id}`);
  } else {
    const created = await stripeFetch('/prices', {
      product: product.id,
      currency: 'brl',
      unit_amount: '2990', // R$ 29,90 em centavos
      'recurring[interval]': 'month',
      'recurring[usage_type]': 'licensed',
      'metadata[parity]': '4900 AOA',
      nickname: 'Prumo Premium Mensal',
    });
    price = created;
    console.log(`✅ Preço recorrente criado: ${created.id} (R$ 29,90/mês)`);
  }

  console.log('\n─── Configure estas env vars ───');
  console.log('STRIPE_SECRET_KEY = (já configurada localmente; replicar na Vercel)');
  console.log(`STRIPE_PRICE_ID   = ${price?.id || '(não disponível)'}`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
