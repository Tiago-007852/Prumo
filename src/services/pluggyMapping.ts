/**
 * Mapeamentos Pluggy → modelos do Prumo (Fase 4).
 * Funções puras, cobertas por test/phase4.test.ts. Vivem no cliente porque
 * os tipos do app estão aqui; a serverless devolve os dados crus.
 */

export interface PluggyAccount {
  id: string;
  name?: string;
  type?: string;
  subtype?: string;
  balance?: number;
  currencyCode?: string;
  accountNumber?: string;
  taxNumber?: string;
  owner?: string;
}

export interface PluggyItem {
  id?: string;
  institution?: { name?: string };
}

const KIND_BY_SUBTYPE: Record<string, string> = {
  CHECKING_ACCOUNT: 'checking',
  SAVINGS_ACCOUNT: 'savings',
  INVESTMENT: 'investment',
  CREDIT_CARD: 'credit',
  DIGITAL_WALLET: 'digital_wallet',
};

/** Converte uma conta Pluggy no modelo Account do Prumo (moeda local do país). */
export function mapPluggyAccount(
  acc: PluggyAccount,
  item: PluggyItem,
  userId: string,
  localCurrency: 'BRL' | 'AOA'
) {
  const subtype = String(acc.subtype || acc.type || '').toUpperCase();
  const kind = (KIND_BY_SUBTYPE[subtype] || 'checking') as
    | 'checking'
    | 'savings'
    | 'investment'
    | 'credit'
    | 'digital_wallet';
  const balance = Number(acc.balance);
  return {
    id: `acc_of_${String(acc.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}_${Date.now().toString(36)}`,
    userId,
    provider: 'open_finance' as const,
    institutionName: item.institution?.name || 'Instituição Open Finance',
    institutionCode: item.id ? String(item.id) : undefined,
    kind,
    balance: isNaN(balance) ? 0 : balance,
    currency: localCurrency,
    lastSyncedAt: new Date().toISOString(),
    status: 'connected' as const,
    accountNumberMask: acc.accountNumber ? `•••• ${String(acc.accountNumber).slice(-4)}` : undefined,
  };
}

export interface PluggyTransaction {
  id: string;
  description?: string;
  amount?: number;
  valueDate?: string;
  date?: string;
  type?: string;
  category?: string;
  merchantName?: string;
  currencyCode?: string;
}

/** Converte uma transação Pluggy no modelo Transaction do Prumo. */
export function mapPluggyTransaction(
  tx: PluggyTransaction,
  accountId: string | null,
  userId: string
) {
  const isCredit = String(tx.type || '').toUpperCase() === 'CREDIT';
  const rawAmount = Number(tx.amount);
  const amount = isNaN(rawAmount) ? 0 : Math.abs(rawAmount);
  const occurredAt = String(tx.valueDate || tx.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  return {
    userId,
    accountId,
    description: String(tx.description || tx.merchantName || 'Transação Open Finance'),
    amount,
    type: isCredit ? ('income' as const) : ('expense' as const),
    category: tx.category || 'Outros',
    source: 'auto_import' as const,
    occurredAt,
    merchant: tx.merchantName || undefined,
    tags: ['open_finance'],
  };
}
