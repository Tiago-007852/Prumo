/**
 * Prumo — Serviço de Persistência Local (Offline-First)
 * Gerencia o armazenamento durável em LocalStorage/IndexedDB para garantir
 * que todos os dados financeiros, orçamentos, contas e novos lançamentos
 * funcionem perfeitamente sem conexão com a internet.
 *
 * Contas reais nascem VAZIAS (sem dados fictícios). O mock de demonstração
 * é usado exclusivamente no modo "Explorar demonstração sem conta".
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

/**
 * Chave de armazenamento. Usuários autenticados têm estado isolado por
 * usuário+país; a chave sem usuário é reservada ao modo demonstração.
 */
export function getStorageKey(country: Country, userId?: string | null): string {
  return userId
    ? `${STORAGE_PREFIX}state_${country}_u_${userId}`
    : `${STORAGE_PREFIX}state_${country}`;
}

/**
 * Cria o perfil de um usuário real rec-registrado: estado vazio, sem nenhum
 * dado fictício. O onboarding (wizard) preenche o perfil logo em seguida.
 */
export function createNewUser(name: string, email: string, country: Country): User {
  return {
    id: `usr_${country.toLowerCase()}_${Date.now().toString(36)}`,
    name: name || 'Novo usuário',
    email,
    country,
    locale: country === 'BR' ? 'pt-BR' : 'pt-AO',
    createdAt: new Date().toISOString(),
    onboardingCompleted: false,
    profile: {
      profession: '',
      primaryGoal: '',
      goalTargetValue: 0,
      goalSavedValue: 0,
      goalDeadline: '',
      monthlyIncomeExpectation: 0,
    },
  };
}

/** Estado completamente vazio (contas reais): nada fictício, nada de demo. */
export function getEmptyCountryState(user: User): CountryDataState {
  return {
    user,
    accounts: [],
    transactions: [],
    budgetLimits: [],
    scenarioEvents: [],
    chatMessages: [],
    goals: [],
    offlineQueue: [],
    lastSavedAt: new Date().toISOString(),
  };
}

/** Estado padrão do modo DEMONSTRAÇÃO (dados fictícios do país). */
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

export interface StorageOwner {
  userId: string | null;
  name?: string;
  email?: string;
}

/**
 * Carrega os dados salvos do país no LocalStorage.
 * - Com `owner.userId` (conta real): sem dados salvos → estado VAZIO com o
 *   perfil novo (wizard de onboarding preencherá). Nunca semeia mock.
 * - Sem `owner.userId` (demo): sem dados salvos → estado fictício do país.
 */
export function loadCountryData(country: Country, owner?: StorageOwner): CountryDataState {
  const key = getStorageKey(country, owner?.userId);
  const isRealUser = !!owner?.userId;

  const defaultsFor = (): CountryDataState =>
    isRealUser
      ? getEmptyCountryState(createNewUser(owner?.name || '', owner?.email || '', country))
      : getDefaultCountryState(country);

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const defaultState = defaultsFor();
      saveCountryData(country, defaultState, owner?.userId);
      return defaultState;
    }

    const parsed = JSON.parse(raw) as CountryDataState;

    // Validações básicas de sanidade
    if (!parsed.user || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts)) {
      console.warn(`[Prumo Storage] Dados locais corrompidos para ${country}, reinicializando.`);
      const defaultState = defaultsFor();
      saveCountryData(country, defaultState, owner?.userId);
      return defaultState;
    }

    return {
      ...defaultsFor(),
      ...parsed,
      offlineQueue: parsed.offlineQueue || [],
    };
  } catch (err) {
    console.error(`[Prumo Storage] Erro ao carregar dados locais para ${country}:`, err);
    return defaultsFor();
  }
}

/**
 * Salva atomicamente o estado completo do país no LocalStorage.
 */
export function saveCountryData(country: Country, data: CountryDataState, userId?: string | null): void {
  const key = getStorageKey(country, userId);
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
export function saveOfflineTransaction(country: Country, tx: Transaction, userId?: string | null): CountryDataState {
  const current = loadCountryData(country, { userId: userId ?? null });
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

  saveCountryData(country, nextState, userId);
  return nextState;
}

/**
 * Restaura o estado padrão:
 * - Conta real: mantém a identidade do usuário e zera TODOS os dados.
 * - Demo: restaura os dados fictícios do país.
 */
export function resetCountryData(country: Country, owner?: StorageOwner): CountryDataState {
  let defaultState: CountryDataState;
  if (owner?.userId) {
    const existing = loadCountryData(country, owner);
    defaultState = {
      ...getEmptyCountryState({
        ...createNewUser(existing.user.name, existing.user.email, country),
        id: existing.user.id,
        createdAt: existing.user.createdAt,
        profile: existing.user.profile,
        onboardingCompleted: true,
      }),
    };
  } else {
    defaultState = getDefaultCountryState(country);
  }
  saveCountryData(country, defaultState, owner?.userId);
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
