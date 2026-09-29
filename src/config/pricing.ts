/**
 * Preços do plano mensal do Prumo (Fase 5 — paywall pós-onboarding).
 *
 * Preço-base: 4.900 Kz/mês (Angola). Para o Brasil, o mesmo valor convertido
 * para reais: 4.900 Kz ≈ US$ 5,3 ≈ R$ 27,70 (câmbio de referência da Fase 4:
 * ~920 AOA/USD, ~5,2 BRL/USD) — comercialmente arredondado para R$ 29,90.
 *
 * Os valores de "âncora" (preço "de") seguem o padrão do funil de vendas:
 * AO -80% · BR -85%.
 */

export interface PlanPricing {
  /** Moeda de cobrança do país. */
  currency: 'BRL' | 'AOA';
  /** Preço mensal praticado. */
  monthly: number;
  /** Preço-âncora riscado ("de R$ 197,00"). */
  anchor: number;
  /** Desconto percentual vs. âncora (selo verde "-85% HOJE"). */
  discountPct: number;
  /** Refrão por dia (ex.: "menos de R$ 1 por dia"). */
  perDayLabel: string;
  /** Micro-copy de cobrança sob o preço. */
  billingNote: string;
}

export const PRICING_BR: PlanPricing = {
  currency: 'BRL',
  monthly: 29.9,
  anchor: 197,
  discountPct: 85,
  perDayLabel: 'menos de R$ 1 por dia',
  billingNote: 'assinatura mensal · cancele quando quiser',
};

export const PRICING_AO: PlanPricing = {
  currency: 'AOA',
  monthly: 4900,
  anchor: 24900,
  discountPct: 80,
  perDayLabel: 'menos de 200 Kz por dia',
  billingNote: 'pagamento mensal · cancele quando quiser',
};

/** Devolve a tabela de preços do país ativo. */
export function pricingFor(country: 'BR' | 'AO'): PlanPricing {
  return country === 'BR' ? PRICING_BR : PRICING_AO;
}
