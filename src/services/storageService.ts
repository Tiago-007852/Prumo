/**
 * Prumo — Serviço de Persistência Local (Offline-First)
 * Gerencia o armazenamento durável em LocalStorage/IndexedDB para garantir
 * que todos os dados financeiros, orçamentos, contas e novos lançamentos
 * funcionem perfeitamente sem conexão com a internet.
 */

import {
  Country,
  User,
  Account,
  Transaction,
  BudgetLimit,
  ScenarioEvent,
  Goal,
  ChatMessage,
  StandardCategory,
} from '../types';
import {
  INITIAL_USER_BR,
  INITIAL_USER_AO,
  INITIAL_ACCOUNTS_BR,
  INITIAL_ACCOUNTS_AO,
  INITIAL_TRANSACTIONS_BR,
  INITIAL_TRANSACTIONS_AO,
  INITIAL_BUDGETS_BR,
  INITIAL_BUDGETS_AO,
  INITIAL_SCENARIO_EVENTS_BR,
  INITIAL_SCENARIO_EVENTS_AO,
  INITIAL_CHAT_MESSAGES_BR,
  INITIAL_CHAT_MESSAGES_AO,
} from '../data/mockData';

export interface CountryDataState {
  user: User;
  accounts: Account[];
  transactions: Transaction[];
  budgetLimits: BudgetLimit[];
  scenarioEvents: ScenarioEvent[];
  chatMessages: ChatMessage[];
  goals: Goal[];
  offlineQueue?: Transaction[];
  lastSavedAt: string;
}

const STORAGE_PREFIX = 'prumo_v1_';

export function getStorageKey(country: Country): string {
  return `${STORAGE_PREFIX}state_${country}`;
}

export function getDefaultCountryState(country: Country): CountryDataState {
  if (country === 'BR') {
    return {
      user: INITIAL_USER_BR,
      accounts: INITIAL_ACCOUNTS_BR,
      transactions: INITIAL_TRANSACTIONS_BR,
      budgetLimits: INITIAL_BUDGETS_BR,
      scenarioEvents: INITIAL_SCENARIO_EVENTS_BR,
      chatMessages: INITIAL_CHAT_MESSAGES_BR,
      goals: [],
      offlineQueue: [],
      lastSavedAt: new Date().toISOString(),
    };
  } else {
    return {
      user: INITIAL_USER_AO,
      accounts: INITIAL_ACCOUNTS_AO,
      transactions: INITIAL_TRANSACTIONS_AO,
      budgetLimits: INITIAL_BUDGETS_AO,
      scenarioEvents: INITIAL_SCENARIO_EVENTS_AO,
      chatMessages: INITIAL_CHAT_MESSAGES_AO,
      goals: [],
      offlineQueue: [],
      lastSavedAt: new Date().toISOString(),
    };
  }
}

/**
 * Carrega os dados salvos do país no LocalStorage.
 * Se não houver nada salvo ou se estiver corrompido, inicializa com o estado padrão do país.
 */
export function loadCountryData(country: Country): CountryDataState {
  const key = getStorageKey(country);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const defaultState = getDefaultCountryState(country);
      saveCountryData(country, defaultState);
      return defaultState;
    }

    const parsed = JSON.parse(raw) as CountryDataState;

    // Validações básicas de sanidade
    if (!parsed.user || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts)) {
      console.warn(`[Prumo Storage] Dados locais corrompidos para ${country}, reinicializando.`);
      const defaultState = getDefaultCountryState(country);
      saveCountryData(country, defaultState);
      return defaultState;
    }

    return {
      ...getDefaultCountryState(country),
      ...parsed,
      offlineQueue: parsed.offlineQueue || [],
    };
  } catch (err) {
    console.error(`[Prumo Storage] Erro ao carregar dados locais para ${country}:`, err);
    return getDefaultCountryState(country);
  }
}

/**
 * Salva atomicamente o estado completo do país no LocalStorage.
 */
export function saveCountryData(country: Country, data: CountryDataState): void {
  const key = getStorageKey(country);
  try {
    const payload: CountryDataState = {
      ...data,
      lastSavedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.error(`[Prumo Storage] Falha ao persistir dados para ${country}:`, err);
  }
}

/**
 * Registra uma transação feita em modo offline no storage local
 */
export function saveOfflineTransaction(country: Country, tx: Transaction): CountryDataState {
  const current = loadCountryData(country);
  const updatedTransactions = [tx, ...current.transactions];
  const updatedQueue = [...(current.offlineQueue || []), tx];

  // Atualizar saldo da conta associada localmente se houver
  const updatedAccounts = current.accounts.map((acc) => {
    if (acc.id === tx.accountId) {
      const delta = tx.type === 'income' ? tx.amount : -tx.amount;
      return { ...acc, balance: acc.balance + delta };
    }
    return acc;
  });

  const nextState: CountryDataState = {
    ...current,
    transactions: updatedTransactions,
    accounts: updatedAccounts,
    offlineQueue: updatedQueue,
    lastSavedAt: new Date().toISOString(),
  };

  saveCountryData(country, nextState);
  return nextState;
}

/**
 * Restaura o estado para os dados de demonstração originais do país
 */
export function resetCountryData(country: Country): CountryDataState {
  const defaultState = getDefaultCountryState(country);
  saveCountryData(country, defaultState);
  return defaultState;
}

/**
 * Persistência da preferência de País e Tema
 */
export function getStoredActiveCountry(): Country {
  try {
    const c = localStorage.getItem(`${STORAGE_PREFIX}active_country`);
    if (c === 'BR' || c === 'AO') return c;
  } catch {}
  return 'BR';
}

export function setStoredActiveCountry(country: Country): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}active_country`, country);
  } catch {}
}

export function getStoredTheme(): 'light' | 'dark' {
  try {
    const t = localStorage.getItem(`${STORAGE_PREFIX}theme`);
    if (t === 'light' || t === 'dark') return t;
  } catch {}
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function setStoredTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}theme`, theme);
  } catch {}
}

/**
 * Categorizador offline determinístico (funciona 100% sem internet nem backend)
 */
export function classifyOffline(description: string): { category: StandardCategory; confidence: number } {
  if (!description) {
    return { category: 'Outros', confidence: 0.5 };
  }

  const descLower = description.toLowerCase();

  if (/uber|99|táxi|taxi|gasolina|posto|sonangol|combustivel|combustível|pedágio|metro|metrô|estacionamento/i.test(descLower)) {
    return { category: 'Transporte', confidence: 0.95 };
  }
  if (/ifood|mercado|supermercado|pão de açúcar|carrefour|kero|hiper|restaurante|padaria|almoço|lanche|café|bife|pizza/i.test(descLower)) {
    return { category: 'Alimentação', confidence: 0.95 };
  }
  if (/aluguel|condomínio|luz|energia|ende|água|epal|iptu|reforma|gás|manutenção casa/i.test(descLower)) {
    return { category: 'Moradia', confidence: 0.95 };
  }
  if (/netflix|spotify|aws|google|icloud|assinatura|curso|software|chatgpt|adobe|starlink|figma/i.test(descLower)) {
    return { category: 'Serviços & Assinaturas', confidence: 0.92 };
  }
  if (/curso|faculdade|livro|escola|udemy|alura|certificação|pos-graduação|mensalidade/i.test(descLower)) {
    return { category: 'Educação', confidence: 0.92 };
  }
  if (/farmácia|drogaria|consulta|médico|dentista|exame|unimed|hospital|clínica/i.test(descLower)) {
    return { category: 'Saúde', confidence: 0.93 };
  }
  if (/cinema|show|viagem|hotel|praia|passagem|bar|festa|ingresso|teatro/i.test(descLower)) {
    return { category: 'Lazer & Cultura', confidence: 0.9 };
  }
  if (/honorários|salário|pix recebido|cliente|freelance|faturamento|pro-labore|multicaixa receb|ordenado/i.test(descLower)) {
    return { category: 'Salário / Honorários', confidence: 0.95 };
  }
  if (/dividendo|rendimento|cdi|tesouro|juros|fii|ações|aplicação/i.test(descLower)) {
    return { category: 'Rendimento / Investimento', confidence: 0.95 };
  }
  if (/macbook|laptop|notebook|monitor|teclado|equipamento|celular|ferramenta|gerador/i.test(descLower)) {
    return { category: 'Equipamentos & Trabalho', confidence: 0.9 };
  }

  return { category: 'Outros', confidence: 0.6 };
}
