/**
 * Prumo — Serviço de Exportação de Dados Financeiros
 * Gera e permite o download de relatórios CSV compatíveis com Excel, Google Sheets e LibreOffice,
 * incluindo formatação com BOM UTF-8 e separadores ideais para os padrões do Brasil e Angola.
 */

import { Transaction, Account, Country } from '../types';

export function escapeCSVField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Gera o conteúdo em formato CSV a partir de uma lista de transações e contas.
 */
export function generateTransactionsCSV(
  transactions: Transaction[],
  accounts: Account[],
  country: Country
): string {
  const headers = [
    'Data',
    'Descrição',
    'Tipo',
    'Categoria',
    'Valor',
    'Moeda',
    'Conta',
    'Estabelecimento',
    'Origem do Dado',
  ];

  const rows = transactions.map((tx) => {
    const account = accounts.find((a) => a.id === tx.accountId);
    const accountName = account ? `${account.institutionName} (${account.kind})` : 'Não especificada';
    const typeLabel = tx.type === 'income' ? 'Receita' : 'Despesa';
    const currency = country === 'BR' ? 'BRL' : 'AOA';
    const sourceLabel =
      tx.source === 'auto_import'
        ? 'Importação Automática'
        : tx.source === 'ai_categorized'
        ? 'Classificado com IA'
        : 'Manual';

    return [
      escapeCSVField(tx.occurredAt),
      escapeCSVField(tx.description),
      escapeCSVField(typeLabel),
      escapeCSVField(tx.category),
      escapeCSVField(tx.amount.toFixed(2)),
      escapeCSVField(currency),
      escapeCSVField(accountName),
      escapeCSVField(tx.merchant || ''),
      escapeCSVField(sourceLabel),
    ].join(';');
  });

  // BOM UTF-8 (\uFEFF) para garantir renderização perfeita de acentos no Excel
  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

/**
 * Inicia o download do arquivo CSV no navegador do usuário
 */
export function downloadCSV(csvContent: string, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
