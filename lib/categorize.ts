/**
 * Categorização inteligente de transações por palavras-chave (Brasil e Angola).
 * Compartilhada entre o servidor Express (dev/self-host) e as funções serverless (api/).
 */

interface CategoryRule {
  category: string;
  confidence: number;
  pattern: RegExp;
}

// A ordem importa: a primeira regra que casar define a categoria.
const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Transporte',
    confidence: 0.95,
    pattern: /uber|99|táxi|taxi|gasolina|posto|sonangol|combustivel|combustível|pedágio|metro|metrô/i,
  },
  {
    category: 'Alimentação',
    confidence: 0.95,
    pattern: /ifood|mercado|supermercado|pão de açúcar|carrefour|kero|hiper|restaurante|padaria|almoço|lanche|café/i,
  },
  {
    category: 'Moradia',
    confidence: 0.95,
    pattern: /aluguel|condomínio|luz|energia|ende|água|epal|iptu|reforma|gás/i,
  },
  {
    category: 'Serviços & Assinaturas',
    confidence: 0.92,
    pattern: /netflix|spotify|aws|google|icloud|assinatura|curso|software|chatgpt|adobe/i,
  },
  {
    category: 'Educação',
    confidence: 0.92,
    pattern: /faculdade|livro|escola|udemy|alura|certificação/i,
  },
  {
    category: 'Saúde',
    confidence: 0.93,
    pattern: /farmácia|drogaria|consulta|médico|dentista|exame|unimed|hospital/i,
  },
  {
    category: 'Lazer & Cultura',
    confidence: 0.9,
    pattern: /cinema|show|viagem|hotel|praia|passagem|bar|festa/i,
  },
  {
    category: 'Salário / Honorários',
    confidence: 0.95,
    pattern: /honorários|salário|pix recebido|cliente|freelance|faturamento|pro-labore|multicaixa receb/i,
  },
  {
    category: 'Rendimento / Investimento',
    confidence: 0.95,
    pattern: /dividendo|rendimento|cdi|tesouro|juros|fii/i,
  },
  {
    category: 'Equipamentos & Trabalho',
    confidence: 0.9,
    pattern: /macbook|laptop|notebook|monitor|teclado|equipamento|celular|ferramenta/i,
  },
];

export interface CategorizeResult {
  category: string;
  confidence: number;
}

export function categorizeDescription(description: string): CategorizeResult {
  const descLower = (description || '').toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(descLower)) {
      return { category: rule.category, confidence: rule.confidence };
    }
  }

  return { category: 'Outros', confidence: 0.7 };
}
