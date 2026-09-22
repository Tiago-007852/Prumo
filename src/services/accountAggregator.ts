import { Account, Country, Transaction } from '../types';

export interface InstitutionOption {
  id: string;
  name: string;
  code: string;
  country: Country;
  iconBg: string;
  logoText: string;
  category: 'bank' | 'fintech' | 'investment';
  supportsOpenFinance: boolean;
}

export interface ConnectAccountParams {
  institutionId: string;
  country: Country;
  initialBalance?: number;
  accountKind?: 'checking' | 'savings' | 'investment' | 'credit';
  accountNumberMask?: string;
  twoFactorToken?: string;
}

/**
 * Interface abstrata AccountAggregator (conforme Seção 2 do Brief)
 * Permite trocar o agregador do Open Finance (Pluggy, Belvo, Quanto)
 * ou chavear para o modo manual em Angola sem reescrever o resto do sistema.
 */
export interface AccountAggregator {
  name: string;
  country: Country;
  listInstitutions(): Promise<InstitutionOption[]>;
  connectAccount(userId: string, params: ConnectAccountParams): Promise<Account>;
  syncTransactions(accountId: string, count?: number): Promise<Transaction[]>;
}

export const INSTITUTIONS_REGISTRY: InstitutionOption[] = [
  // Brasil (Open Finance)
  {
    id: 'br_nubank',
    name: 'Nubank',
    code: '260',
    country: 'BR',
    iconBg: '#820AD1',
    logoText: 'Nu',
    category: 'fintech',
    supportsOpenFinance: true,
  },
  {
    id: 'br_itau',
    name: 'Itaú Unibanco',
    code: '341',
    country: 'BR',
    iconBg: '#EC7000',
    logoText: 'Itaú',
    category: 'bank',
    supportsOpenFinance: true,
  },
  {
    id: 'br_inter',
    name: 'Banco Inter',
    code: '077',
    country: 'BR',
    iconBg: '#FF7A00',
    logoText: 'Inter',
    category: 'fintech',
    supportsOpenFinance: true,
  },
  {
    id: 'br_bb',
    name: 'Banco do Brasil',
    code: '001',
    country: 'BR',
    iconBg: '#F8D117',
    logoText: 'BB',
    category: 'bank',
    supportsOpenFinance: true,
  },
  {
    id: 'br_bradesco',
    name: 'Bradesco',
    code: '237',
    country: 'BR',
    iconBg: '#CC092F',
    logoText: 'Brd',
    category: 'bank',
    supportsOpenFinance: true,
  },
  {
    id: 'br_xp',
    name: 'XP Investimentos',
    code: '102',
    country: 'BR',
    iconBg: '#000000',
    logoText: 'XP',
    category: 'investment',
    supportsOpenFinance: true,
  },

  // Angola (Instituições Bancárias para integração manual / extrato)
  {
    id: 'ao_bai',
    name: 'Banco Angolano de Investimentos (BAI)',
    code: 'BAI',
    country: 'AO',
    iconBg: '#0A3B75',
    logoText: 'BAI',
    category: 'bank',
    supportsOpenFinance: false,
  },
  {
    id: 'ao_bfa',
    name: 'Banco de Fomento Angola (BFA)',
    code: 'BFA',
    country: 'AO',
    iconBg: '#C8102E',
    logoText: 'BFA',
    category: 'bank',
    supportsOpenFinance: false,
  },
  {
    id: 'ao_bic',
    name: 'Banco BIC Angola',
    code: 'BIC',
    country: 'AO',
    iconBg: '#D9261C',
    logoText: 'BIC',
    category: 'bank',
    supportsOpenFinance: false,
  },
  {
    id: 'ao_standard',
    name: 'Standard Bank Angola',
    code: 'SBA',
    country: 'AO',
    iconBg: '#0033A0',
    logoText: 'SBA',
    category: 'bank',
    supportsOpenFinance: false,
  },
  {
    id: 'ao_caixa',
    name: 'Caixa Geral Angola (BCGA)',
    code: 'CGA',
    country: 'AO',
    iconBg: '#006699',
    logoText: 'CGA',
    category: 'bank',
    supportsOpenFinance: false,
  },
];

/**
 * Implementação Open Finance Brasil (Pluggy / Belvo compliant)
 */
export class OpenFinanceBrazilAggregator implements AccountAggregator {
  name = 'Pluggy Open Finance Provider (BACEN)';
  country: Country = 'BR';

  async listInstitutions(): Promise<InstitutionOption[]> {
    return INSTITUTIONS_REGISTRY.filter((inst) => inst.country === 'BR');
  }

  async connectAccount(userId: string, params: ConnectAccountParams): Promise<Account> {
    const inst = INSTITUTIONS_REGISTRY.find((i) => i.id === params.institutionId) || {
      name: 'Banco Conectado (Open Finance)',
      code: 'OF',
    };

    const initialBalance = params.initialBalance !== undefined ? params.initialBalance : 8420.5;

    return {
      id: `acc-of-${Date.now()}`,
      userId,
      provider: 'open_finance',
      institutionName: inst.name,
      institutionCode: inst.code,
      kind: params.accountKind || 'checking',
      balance: initialBalance,
      currency: 'BRL',
      lastSyncedAt: new Date().toISOString(),
      status: 'connected',
      accountNumberMask: params.accountNumberMask || '•••• 4920',
    };
  }

  async syncTransactions(accountId: string): Promise<Transaction[]> {
    const now = new Date();
    const d = (daysAgo: number) => {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - daysAgo);
      return dt.toISOString().split('T')[0];
    };

    return [
      {
        id: `tx-of-1-${Date.now()}`,
        userId: 'current-user',
        accountId,
        description: 'Pix Recebido - Consultoria Estratégica',
        amount: 5400,
        type: 'income',
        category: 'Salário / Honorários',
        source: 'auto_import',
        occurredAt: d(2),
        createdAt: new Date().toISOString(),
        merchant: 'Cliente Tech Ltda',
      },
      {
        id: `tx-of-2-${Date.now()}`,
        userId: 'current-user',
        accountId,
        description: 'Supermercado Pão de Açúcar',
        amount: 684.2,
        type: 'expense',
        category: 'Alimentação',
        source: 'auto_import',
        occurredAt: d(3),
        createdAt: new Date().toISOString(),
        merchant: 'Pão de Açúcar',
      },
      {
        id: `tx-of-3-${Date.now()}`,
        userId: 'current-user',
        accountId,
        description: 'Uber Viagens',
        amount: 46.5,
        type: 'expense',
        category: 'Transporte',
        source: 'auto_import',
        occurredAt: d(4),
        createdAt: new Date().toISOString(),
        merchant: 'Uber BR',
      },
      {
        id: `tx-of-4-${Date.now()}`,
        userId: 'current-user',
        accountId,
        description: 'Assinatura AWS Cloud',
        amount: 220,
        type: 'expense',
        category: 'Serviços & Assinaturas',
        source: 'auto_import',
        occurredAt: d(6),
        createdAt: new Date().toISOString(),
        merchant: 'Amazon Web Services',
      },
    ];
  }
}

/**
 * Implementação Manual / Extrato para Angola (e contas manuais do Brasil)
 */
export class ManualAngolaAggregator implements AccountAggregator {
  name = 'Angola Manual Statement Provider';
  country: Country = 'AO';

  async listInstitutions(): Promise<InstitutionOption[]> {
    return INSTITUTIONS_REGISTRY.filter((inst) => inst.country === 'AO');
  }

  async connectAccount(userId: string, params: ConnectAccountParams): Promise<Account> {
    const inst = INSTITUTIONS_REGISTRY.find((i) => i.id === params.institutionId) || {
      name: 'Banco BAI Angola',
      code: 'BAI',
    };

    const initialBalance = params.initialBalance !== undefined ? params.initialBalance : 350000;

    return {
      id: `acc-manual-${Date.now()}`,
      userId,
      provider: 'manual',
      institutionName: inst.name,
      institutionCode: inst.code,
      kind: params.accountKind || 'checking',
      balance: initialBalance,
      currency: 'AOA',
      lastSyncedAt: new Date().toISOString(),
      status: 'manual',
      accountNumberMask: params.accountNumberMask || '•••• 8190',
    };
  }

  async syncTransactions(accountId: string): Promise<Transaction[]> {
    const now = new Date();
    const d = (daysAgo: number) => {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - daysAgo);
      return dt.toISOString().split('T')[0];
    };

    return [
      {
        id: `tx-ao-1-${Date.now()}`,
        userId: 'current-user',
        accountId,
        description: 'Transferência Multicaixa - Serviços Prestados',
        amount: 450000,
        type: 'income',
        category: 'Salário / Honorários',
        source: 'manual',
        occurredAt: d(1),
        createdAt: new Date().toISOString(),
        merchant: 'Empresa Parceira Luanda',
      },
      {
        id: `tx-ao-2-${Date.now()}`,
        userId: 'current-user',
        accountId,
        description: 'Compras Hipermercado Kero',
        amount: 85000,
        type: 'expense',
        category: 'Alimentação',
        source: 'manual',
        occurredAt: d(3),
        createdAt: new Date().toISOString(),
        merchant: 'Hiper Kero Luanda',
      },
      {
        id: `tx-ao-3-${Date.now()}`,
        userId: 'current-user',
        accountId,
        description: 'Combustível Sonangol',
        amount: 22000,
        type: 'expense',
        category: 'Transporte',
        source: 'manual',
        occurredAt: d(5),
        createdAt: new Date().toISOString(),
        merchant: 'Posto Sonangol',
      },
    ];
  }
}

/**
 * Factory para obter o agregador apropriado
 */
export function getAccountAggregator(country: Country): AccountAggregator {
  if (country === 'BR') {
    return new OpenFinanceBrazilAggregator();
  }
  return new ManualAngolaAggregator();
}
