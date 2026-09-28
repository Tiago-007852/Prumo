/**
 * Cliente Open Finance (Pluggy) do frontend — Fase 4.
 *
 * Fluxo: pedimos um connect token ao backend, abrimos o widget oficial
 * (script + iframe modal); no sucesso buscamos contas/transações do item
 * via backend e mapeamos para os modelos do Prumo.
 */

import type { Account, Transaction, Country } from '../types';
import { mapPluggyAccount, mapPluggyTransaction, PluggyAccount } from './pluggyMapping';

/** Carrega o script oficial do Pluggy Connect uma única vez. */
function loadPluggyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('sem window'));
    if ((window as any).PluggyConnect) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-pluggy-connect]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar widget Pluggy')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.4/pluggy-connect.js';
    s.async = true;
    s.setAttribute('data-pluggy-connect', 'true');
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar widget Pluggy'));
    document.head.appendChild(s);
  });
}

/** Pede o connect token de curta duração ao backend. */
async function fetchConnectToken(): Promise<string> {
  const res = await fetch('/api/openfinance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'connect_token' }),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.connectToken) {
    throw new Error(data?.error || 'Não foi possível iniciar a conexão Open Finance');
  }
  return String(data.connectToken);
}

export interface ImportedAccountsResult {
  accounts: Account[];
  transactions: Transaction[];
  itemId: string;
}

/** Busca contas do item e as últimas transações, já mapeadas para o Prumo. */
async function fetchItemData(
  itemId: string,
  userId: string,
  country: Country
): Promise<ImportedAccountsResult> {
  const localCurrency = country === 'BR' ? ('BRL' as const) : ('AOA' as const);

  const accountsRes = await fetch(`/api/openfinance?accounts=${encodeURIComponent(itemId)}`, {
    credentials: 'same-origin',
  });
  const accountsData = await accountsRes.json().catch(() => ({}));
  if (!accountsRes.ok) {
    throw new Error(accountsData?.error || 'Falha ao importar contas');
  }

  const rawAccounts: PluggyAccount[] = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
  const institution = accountsData.item?.institution?.name;
  const item = { id: accountsData.item?.id, institution: institution ? { name: institution } : undefined };

  const accounts = rawAccounts.map((acc) => mapPluggyAccount(acc, item, userId, localCurrency));

  const txRes = await fetch(`/api/openfinance?transactions=${encodeURIComponent(itemId)}`, {
    credentials: 'same-origin',
  });
  let transactions: Transaction[] = [];
  if (txRes.ok) {
    const txData = await txRes.json().catch(() => ({}));
    const rawTx = Array.isArray(txData.transactions) ? txData.transactions : [];
    transactions = rawTx.slice(0, 120).map((tx: unknown) =>
      mapPluggyTransaction(tx as any, accounts[0]?.id ?? null, userId)
    );
  }

  return { accounts, transactions, itemId };
}

/**
 * Abre o widget Pluggy Connect e, no sucesso, importa contas + transações.
 * Sem PLUGGY_* no backend, o backend responde 501 e o erro explica o motivo.
 */
export async function connectOpenFinance(
  userId: string,
  country: Country,
  onAccountsImported?: (result: ImportedAccountsResult) => void
): Promise<ImportedAccountsResult> {
  const connectToken = await fetchConnectToken();
  await loadPluggyScript();

  const PluggyConnectCtor = (window as any).PluggyConnect;
  if (typeof PluggyConnectCtor !== 'function') {
    throw new Error('Widget Pluggy indisponível (script bloqueado?)');
  }

  return new Promise<ImportedAccountsResult>((resolve, reject) => {
    const widget = new PluggyConnectCtor({
      connectToken,
      includeInstitutions: country === 'BR' ? ['bradesco', 'itau', 'nubank', 'inter'] : undefined,
      environment: import.meta.env.PROD ? 'production' : 'sandbox',
      onSuccess: async (itemData: { item?: { id?: string } }) => {
        try {
          const itemId = String(itemData?.item?.id || '');
          if (!itemId) return reject(new Error('Conexão concluída sem identificador do item'));
          const result = await fetchItemData(itemId, userId, country);
          onAccountsImported?.(result);
          resolve(result);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      },
      onError: (error: unknown) => {
        reject(error instanceof Error ? error : new Error('Conexão Open Finance cancelada ou falhou'));
      },
      onClose: () => {
        // usuário fechou sem concluir — não é erro fatal, apenas não resolve
      },
    });
    widget.open();
  });
}
