import { User, Account, Transaction, BudgetLimit, ScenarioEvent, Goal, ChatMessage } from '../types';

/**
 * Datas da demo sempre recentes: ancoradas no mês corrente para que os
 * lançamentos iniciais caiam dentro do mês em curso e as métricas do painel
 * ("Receitas do Mês", orçamentos, gráfico de 30 dias) nunca fiquem vazias.
 * O dia é limitado ao dia atual para não gerar lançamentos "do futuro".
 */
function currentMonthDay(day: number): string {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(day, now.getDate(), daysInMonth));
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${String(safeDay).padStart(2, '0')}`;
}

function currentMonthTimestamp(day: number, hour = 12, minute = 0): string {
  return `${currentMonthDay(day)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
}

/** Mês 'YYYY-MM' N meses no futuro (prazos de metas da demo). */
function monthsAhead(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const INITIAL_USER_BR: User = {
  id: 'usr_br_01',
  name: 'Mariana Duarte',
  email: 'mariana.duarte@prumo.app',
  country: 'BR',
  locale: 'pt-BR',
  createdAt: '2026-08-01T10:00:00Z',
  twoFactorEnabled: true,
  profile: {
    profession: 'Designer de Produto (PJ)',
    primaryGoal: 'Reserva de Emergência de 6 Meses',
    goalTargetValue: 36000,
    goalSavedValue: 24500,
    goalDeadline: monthsAhead(3),
    monthlyIncomeExpectation: 9500,
    experienceLevel: 'intermediario',
  },
};

export const INITIAL_USER_AO: User = {
  id: 'usr_ao_01',
  name: 'António Gaspar',
  email: 'antonio.gaspar@prumo.app',
  country: 'AO',
  locale: 'pt-AO',
  createdAt: '2026-08-01T10:00:00Z',
  twoFactorEnabled: true,
  profile: {
    profession: 'Engenheiro de Redes & Consultor',
    primaryGoal: 'Aquisição de Escritório Próprio em Luanda',
    goalTargetValue: 12000000,
    goalSavedValue: 4800000,
    goalDeadline: monthsAhead(9),
    monthlyIncomeExpectation: 1400000,
    experienceLevel: 'avancado',
  },
};

export const INITIAL_ACCOUNTS_BR: Account[] = [
  {
    id: 'acc_br_1',
    userId: 'usr_br_01',
    provider: 'open_finance',
    institutionName: 'Nubank',
    institutionCode: '260',
    kind: 'checking',
    balance: 14850.75,
    currency: 'BRL',
    lastSyncedAt: currentMonthTimestamp(20, 17, 30),
    status: 'connected',
    accountNumberMask: '•••• 3812',
  },
  {
    id: 'acc_br_2',
    userId: 'usr_br_01',
    provider: 'open_finance',
    institutionName: 'Itaú Personalité',
    institutionCode: '341',
    kind: 'investment',
    balance: 9650.0,
    currency: 'BRL',
    lastSyncedAt: currentMonthTimestamp(20, 16, 45),
    status: 'connected',
    accountNumberMask: '•••• 9104',
  },
  {
    id: 'acc_br_3',
    userId: 'usr_br_01',
    provider: 'manual',
    institutionName: 'Caixinha de Emergência Física',
    kind: 'savings',
    balance: 1500.0,
    currency: 'BRL',
    lastSyncedAt: currentMonthTimestamp(19, 12, 0),
    status: 'manual',
    accountNumberMask: 'Manual',
  },
];

export const INITIAL_ACCOUNTS_AO: Account[] = [
  {
    id: 'acc_ao_1',
    userId: 'usr_ao_01',
    provider: 'manual',
    institutionName: 'Banco Angolano de Investimentos (BAI)',
    institutionCode: 'BAI',
    kind: 'checking',
    balance: 3850000,
    currency: 'AOA',
    lastSyncedAt: currentMonthTimestamp(20, 15, 0),
    status: 'manual',
    accountNumberMask: '•••• 7721',
  },
  {
    id: 'acc_ao_2',
    userId: 'usr_ao_01',
    provider: 'manual',
    institutionName: 'Banco de Fomento Angola (BFA)',
    institutionCode: 'BFA',
    kind: 'savings',
    balance: 950000,
    currency: 'AOA',
    lastSyncedAt: currentMonthTimestamp(19, 11, 0),
    status: 'manual',
    accountNumberMask: '•••• 1042',
  },
];

export const INITIAL_TRANSACTIONS_BR: Transaction[] = [
  {
    id: 'tx_br_1',
    userId: 'usr_br_01',
    accountId: 'acc_br_1',
    description: 'Pix Recebido - Projeto Fintech SaaS',
    amount: 9500,
    type: 'income',
    category: 'Salário / Honorários',
    source: 'auto_import',
    occurredAt: currentMonthDay(5),
    createdAt: currentMonthTimestamp(5, 14, 0),
    merchant: 'Veloce Studio',
  },
  {
    id: 'tx_br_2',
    userId: 'usr_br_01',
    accountId: 'acc_br_1',
    description: 'Aluguel Apartamento Pinheiros',
    amount: 2850,
    type: 'expense',
    category: 'Moradia',
    source: 'auto_import',
    occurredAt: currentMonthDay(8),
    createdAt: currentMonthTimestamp(8, 9, 0),
    merchant: 'QuintoAndar',
  },
  {
    id: 'tx_br_3',
    userId: 'usr_br_01',
    accountId: 'acc_br_1',
    description: 'Supermercado St. Marche',
    amount: 920.4,
    type: 'expense',
    category: 'Alimentação',
    source: 'auto_import',
    occurredAt: currentMonthDay(12),
    createdAt: currentMonthTimestamp(12, 18, 30),
    merchant: 'St. Marche Jardins',
  },
  {
    id: 'tx_br_4',
    userId: 'usr_br_01',
    accountId: 'acc_br_1',
    description: 'Assinatura Figma & Adobe CC',
    amount: 340,
    type: 'expense',
    category: 'Serviços & Assinaturas',
    source: 'ai_categorized',
    occurredAt: currentMonthDay(14),
    createdAt: currentMonthTimestamp(14, 8, 0),
    merchant: 'Adobe Systems',
  },
  {
    id: 'tx_br_5',
    userId: 'usr_br_01',
    accountId: 'acc_br_1',
    description: 'Uber & Mobilidade Urbana',
    amount: 215.8,
    type: 'expense',
    category: 'Transporte',
    source: 'auto_import',
    occurredAt: currentMonthDay(17),
    createdAt: currentMonthTimestamp(17, 20, 15),
    merchant: 'Uber do Brasil',
  },
  {
    id: 'tx_br_6',
    userId: 'usr_br_01',
    accountId: 'acc_br_2',
    description: 'Rendimento CDB Liquidez Diária',
    amount: 145.2,
    type: 'income',
    category: 'Rendimento / Investimento',
    source: 'auto_import',
    occurredAt: currentMonthDay(18),
    createdAt: currentMonthTimestamp(18, 7, 0),
    merchant: 'Itaú Unibanco',
  },
  {
    id: 'tx_br_7',
    userId: 'usr_br_01',
    accountId: 'acc_br_1',
    description: 'Jantar Restaurante Arturito',
    amount: 310,
    type: 'expense',
    category: 'Alimentação',
    source: 'manual',
    occurredAt: currentMonthDay(19),
    createdAt: currentMonthTimestamp(19, 22, 0),
    merchant: 'Restaurante Arturito',
  },
];

export const INITIAL_TRANSACTIONS_AO: Transaction[] = [
  {
    id: 'tx_ao_1',
    userId: 'usr_ao_01',
    accountId: 'acc_ao_1',
    description: 'Transferência Multicaixa - Contrato Telecom',
    amount: 1400000,
    type: 'income',
    category: 'Salário / Honorários',
    source: 'manual',
    occurredAt: currentMonthDay(4),
    createdAt: currentMonthTimestamp(4, 11, 0),
    merchant: 'Unitel Angola',
  },
  {
    id: 'tx_ao_2',
    userId: 'usr_ao_01',
    accountId: 'acc_ao_1',
    description: 'Renda Residencial Miramar',
    amount: 450000,
    type: 'expense',
    category: 'Moradia',
    source: 'manual',
    occurredAt: currentMonthDay(6),
    createdAt: currentMonthTimestamp(6, 10, 0),
    merchant: 'Imobiliária Luanda',
  },
  {
    id: 'tx_ao_3',
    userId: 'usr_ao_01',
    accountId: 'acc_ao_1',
    description: 'Compras Hipermercado Kero Nova Vida',
    amount: 145000,
    type: 'expense',
    category: 'Alimentação',
    source: 'manual',
    occurredAt: currentMonthDay(11),
    createdAt: currentMonthTimestamp(11, 16, 0),
    merchant: 'Kero Hipermercado',
  },
  {
    id: 'tx_ao_4',
    userId: 'usr_ao_01',
    accountId: 'acc_ao_1',
    description: 'Abastecimento Sonangol Talatona',
    amount: 35000,
    type: 'expense',
    category: 'Transporte',
    source: 'manual',
    occurredAt: currentMonthDay(15),
    createdAt: currentMonthTimestamp(15, 9, 0),
    merchant: 'Sonangol Distribuidora',
  },
  {
    id: 'tx_ao_5',
    userId: 'usr_ao_01',
    accountId: 'acc_ao_1',
    description: 'Assinatura Starlink & Servidores',
    amount: 68000,
    type: 'expense',
    category: 'Serviços & Assinaturas',
    source: 'ai_categorized',
    occurredAt: currentMonthDay(16),
    createdAt: currentMonthTimestamp(16, 12, 0),
    merchant: 'Starlink Luanda',
  },
];

export const INITIAL_BUDGETS_BR: BudgetLimit[] = [
  { id: 'bd_1', userId: 'usr_br_01', category: 'Moradia', monthlyLimit: 3200 },
  { id: 'bd_2', userId: 'usr_br_01', category: 'Alimentação', monthlyLimit: 1400 },
  { id: 'bd_3', userId: 'usr_br_01', category: 'Transporte', monthlyLimit: 400 },
  { id: 'bd_4', userId: 'usr_br_01', category: 'Serviços & Assinaturas', monthlyLimit: 450 },
  { id: 'bd_5', userId: 'usr_br_01', category: 'Lazer & Cultura', monthlyLimit: 600 },
];

export const INITIAL_BUDGETS_AO: BudgetLimit[] = [
  { id: 'bd_ao_1', userId: 'usr_ao_01', category: 'Moradia', monthlyLimit: 500000 },
  { id: 'bd_ao_2', userId: 'usr_ao_01', category: 'Alimentação', monthlyLimit: 200000 },
  { id: 'bd_ao_3', userId: 'usr_ao_01', category: 'Transporte', monthlyLimit: 60000 },
  { id: 'bd_ao_4', userId: 'usr_ao_01', category: 'Serviços & Assinaturas', monthlyLimit: 100000 },
  { id: 'bd_ao_5', userId: 'usr_ao_01', category: 'Lazer & Cultura', monthlyLimit: 90000 },
];

export const INITIAL_SCENARIO_EVENTS_BR: ScenarioEvent[] = [
  {
    id: 'sc_evt_1',
    label: 'Novo Contrato Recorrente (Retainer)',
    description: 'Adição de cliente fixo para consultoria mensal de design system',
    type: 'income',
    monthlyDelta: 3500,
    startMonth: 2,
    enabled: true,
    category: 'Salário / Honorários',
  },
  {
    id: 'sc_evt_2',
    label: 'Otimização de Custos e Assinaturas',
    description: 'Cancelamento de ferramentas duplicadas e negociação de plano',
    type: 'expense',
    monthlyDelta: -280, // reduz despesas
    startMonth: 1,
    enabled: true,
    category: 'Serviços & Assinaturas',
  },
  {
    id: 'sc_evt_3',
    label: 'Troca de Estação de Trabalho (MacBook Pro)',
    description: 'Renovação do equipamento de trabalho profissional',
    type: 'expense',
    monthlyDelta: 0,
    oneTimeCost: 14500,
    startMonth: 4,
    enabled: false,
    category: 'Equipamentos & Trabalho',
  },
  {
    id: 'sc_evt_4',
    label: 'Imprevisto / Reserva Saúde',
    description: 'Procedimento odontológico ou exame particular',
    type: 'expense',
    monthlyDelta: 0,
    oneTimeCost: 2800,
    startMonth: 3,
    enabled: false,
    category: 'Saúde',
  },
];

export const INITIAL_SCENARIO_EVENTS_AO: ScenarioEvent[] = [
  {
    id: 'sc_ao_1',
    label: 'Novo Contrato de Manutenção de Redes',
    description: 'Consultoria regular para empresa no polo de Viana',
    type: 'income',
    monthlyDelta: 500000,
    startMonth: 2,
    enabled: true,
    category: 'Salário / Honorários',
  },
  {
    id: 'sc_ao_2',
    label: 'Compra de Grupo Gerador & Estabilizador',
    description: 'Garantia de fornecimento contínuo de energia para o escritório',
    type: 'expense',
    monthlyDelta: 0,
    oneTimeCost: 1200000,
    startMonth: 3,
    enabled: false,
    category: 'Equipamentos & Trabalho',
  },
  {
    id: 'sc_ao_3',
    label: 'Corte de Custos de Deslocamento',
    description: 'Migração de parte das reuniões para o modelo virtual',
    type: 'expense',
    monthlyDelta: -30000,
    startMonth: 1,
    enabled: true,
    category: 'Transporte',
  },
];

export const INITIAL_CHAT_MESSAGES_BR: ChatMessage[] = [
  {
    id: 'msg_welcome_br',
    userId: 'usr_br_01',
    role: 'assistant',
    content:
      'Olá, Mariana! Sou o Prumo, seu copiloto financeiro. Já analisei seu saldo agregado de R$ 26.000,75 e sua taxa de poupança atual de 51.5%. Como posso ajudar hoje com sua reserva de emergência ou na simulação de novos contratos?',
    createdAt: currentMonthTimestamp(20, 18, 0),
    suggestedAction: {
      label: 'Simular impacto do novo cliente',
      actionType: 'open_scenario',
    },
  },
];

export const INITIAL_CHAT_MESSAGES_AO: ChatMessage[] = [
  {
    id: 'msg_welcome_ao',
    userId: 'usr_ao_01',
    role: 'assistant',
    content:
      'Olá, António! Sou o Prumo, o seu copiloto financeiro. Consolidei as suas contas no BAI e BFA com saldo total de Kz 4.800.000,00. As suas despesas essenciais estão dentro dos limites deste mês. Em que posso ser útil com o plano para o escritório próprio?',
    createdAt: currentMonthTimestamp(20, 18, 0),
    suggestedAction: {
      label: 'Ver projeção da meta',
      actionType: 'check_goal',
    },
  },
];
