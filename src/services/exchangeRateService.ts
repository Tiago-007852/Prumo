/**
 * Câmbio offline-first (Fase 4): multi-moeda com foco em BRL ↔ AOA ↔ USD.
 *
 * Fonte: open.er-api.com (ExchangeRate-API, Open Access — sem chave).
 * As taxas são cacheadas no LocalStorage por 12h; sem cache e sem rede,
 * usamos fallback determinístico para o app continuar funcionando offline.
 */

const RATES_CACHE_KEY = 'prumo_v1_fx_rates';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h (a fonte atualiza 1x/dia)

export type ExchangeCurrency = 'BRL' | 'AOA' | 'USD';

export interface ExchangeRates {
  base: 'USD';
  /** USD → moeda */
  rates: Record<ExchangeCurrency, number>;
  updatedAt: number; // epoch ms
  /** true quando vieram do fallback offline (não são cotação atual). */
  fallback: boolean;
}

/** Fallback determinístico (taxas de referência conservadoras). */
export const FALLBACK_RATES: ExchangeRates = {
  base: 'USD',
  rates: { USD: 1, BRL: 5.2, AOA: 920 },
  updatedAt: 0,
  fallback: true,
};

export function readCachedRates(): ExchangeRates | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExchangeRates;
    if (!parsed?.rates?.BRL || !parsed?.rates?.AOA || !parsed?.updatedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cacheRates(rates: ExchangeRates): void {
  try {
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(rates));
  } catch {
    /* quota cheia — segue em memória */
  }
}

export function isCacheFresh(cached: ExchangeRates | null, now = Date.now()): boolean {
  return Boolean(cached && now - cached.updatedAt < CACHE_TTL_MS);
}

/**
 * Busca as taxas atuais: cache fresco → rede → cache velho → fallback.
 * Nunca lança; offline-first de verdade.
 */
export async function fetchExchangeRates(forceRefresh = false): Promise<ExchangeRates> {
  const cached = readCachedRates();
  if (!forceRefresh && isCacheFresh(cached)) return cached!;

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(`fx ${res.status}`);
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== 'success' || !data.rates?.BRL || !data.rates?.AOA) {
      throw new Error('fx payload inválido');
    }
    const fresh: ExchangeRates = {
      base: 'USD',
      rates: {
        USD: 1,
        BRL: Number(data.rates.BRL),
        AOA: Number(data.rates.AOA),
      },
      updatedAt: Date.now(),
      fallback: false,
    };
    cacheRates(fresh);
    return fresh;
  } catch {
    if (cached) return cached; // cache velho ainda é melhor que fallback
    return FALLBACK_RATES;
  }
}

/**
 * Converte `amount` de `from` para `to` via base USD.
 * Função pura — coberta por testes.
 */
export function convertAmount(
  amount: number,
  from: ExchangeCurrency,
  to: ExchangeCurrency,
  rates: ExchangeRates
): number {
  if (from === to) return amount;
  const rateFrom = rates.rates[from];
  const rateTo = rates.rates[to];
  if (!rateFrom || !rateTo) return amount;
  const inUsd = amount / rateFrom;
  return Math.round(inUsd * rateTo * 100) / 100;
}

/** Formata o valor na moeda alvo (BRL pt-BR, AOA/USD pt-AO). */
export function formatMoney(amount: number, currency: ExchangeCurrency): string {
  const locale = currency === 'BRL' ? 'pt-BR' : 'pt-AO';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'AOA' ? 0 : 2,
    }).format(amount);
  } catch {
    const symbols: Record<ExchangeCurrency, string> = { BRL: 'R$', AOA: 'Kz', USD: 'US$' };
    return `${symbols[currency]} ${amount.toFixed(currency === 'AOA' ? 0 : 2)}`;
  }
}
