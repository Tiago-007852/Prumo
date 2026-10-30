/**
 * Constantes configuráveis da landing (design "liquid glass").
 *
 * Tudo o que é número/texto de marketing fica aqui — nada espalhado pelo
 * componente. Os valores vieram da referência em docs/reference-landing/.
 */

export type LandingCountry = 'BR' | 'AO';

/** Empresas que já usam o Prumo, por país. */
export const LANDING_COMPANIES: Record<LandingCountry, number> = {
  AO: 12,
  BR: 5,
};

/** Total do painel de prova social (soma dos países — nunca fixar à mão). */
export const LANDING_TOTAL_COMPANIES = LANDING_COMPANIES.AO + LANDING_COMPANIES.BR; // 17

/**
 * Marcas mostradas nos avatares do painel de prova social (ao lado de
 * "17 empresas").
 *
 * São marcas abstratas — não representam nenhuma empresa real e não há nomes
 * nem logotipos de terceiros aqui. Para mostrar o logotipo real de uma empresa,
 * basta acrescentar `src` (caminho de um SVG/PNG em `public/`) à entrada
 * respetiva: o avatar passa a usar a imagem em vez da marca abstrata.
 * A ordem das entradas acompanha as quatro cores definidas no CSS (.avs i).
 */
export type LandingLogoMark = 'diamond' | 'hexagon' | 'triangle' | 'ring';

export interface LandingSocialLogo {
  /** Marca abstrata desenhada em SVG (usada quando não há `src`). */
  mark: LandingLogoMark;
  /** Nome da empresa (mostrado ao passar o rato por cima do avatar). Opcional. */
  name?: string;
  /** Logotipo real (ex.: '/logos/acme.svg'). Opcional. */
  src?: string;
}

export const LANDING_SOCIAL_LOGOS: readonly LandingSocialLogo[] = [
  { mark: 'diamond', name: 'Bazarixy', src: '/logos/bazarixy.png' },
  { mark: 'hexagon', name: 'Bazar da Laura', src: '/logos/bazar-da-laura.png' },
  { mark: 'triangle', name: 'Jemac', src: '/logos/jemac.png' },
  { mark: 'ring', name: 'AltomaFood', src: '/logos/altomafood.png' },
];

/** País selecionado por padrão no seletor de moeda do mockup. */
export const LANDING_DEFAULT_COUNTRY: LandingCountry = 'BR';

export interface LandingPreview {
  /** Bandeira e símbolo da moeda mostrados no seletor. */
  flag: string;
  cur: string;
  /** Saldo projetado no ecrã do telefone. */
  bal: string;
  /** Variação sobre o mês. */
  up: string;
  /** Gastos do mês. */
  gastos: string;
  /** [rótulo da meta, percentual]. */
  meta: readonly [string, string];
  /** Pergunta do utilizador na conversa com o copiloto. */
  ask: string;
  /** Resposta do copiloto. */
  reply: string;
}

/** Conteúdo do mockup do telefone por país (re-renderizado com a animação "swap"). */
export const LANDING_PREVIEW: Record<LandingCountry, LandingPreview> = {
  BR: {
    flag: '🇧🇷',
    cur: 'R$',
    bal: 'R$ 18.420',
    up: '▲ 12,4% sobre este mês',
    gastos: 'R$ 3.280',
    meta: ['Meta viagem', '68%'],
    ask: 'Posso comprar um carro de 80 mil?',
    reply:
      'Com a sua poupança atual, só em 14 meses sem apertar o orçamento. Quer ver um plano de entrada?',
  },
  AO: {
    flag: '🇦🇴',
    cur: 'Kz',
    bal: 'Kz 4.850.000',
    up: '▲ 9,8% sobre este mês',
    gastos: 'Kz 412.000',
    meta: ['Meta casa', '41%'],
    ask: 'Posso comprar um carro de 12 milhões?',
    reply:
      'Com a sua poupança atual, só em 16 meses sem apertar o orçamento. Quer ver um plano de entrada?',
  },
};

/** Ordem dos botões do seletor de moeda (referência: BR primeiro). */
export const LANDING_PREVIEW_ORDER: LandingCountry[] = ['BR', 'AO'];
