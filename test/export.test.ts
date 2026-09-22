/**
 * Testes automatizados do Módulo de Exportação CSV do Prumo
 */

import { generateTransactionsCSV, escapeCSVField } from '../src/services/exportService';
import { Transaction, Account } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Test Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

function runExportTests() {
  console.log('\n--- 🧪 Iniciando Testes de Exportação de Dados CSV ---\n');

  // Teste 1: Escape de campos com aspas e caracteres especiais
  assert(escapeCSVField('Almoço "Executivo"') === '"Almoço ""Executivo"""', 'Escape deve duplicar aspas internas');
  assert(escapeCSVField(1250.5) === '"1250.5"', 'Números devem ser convertidos em string entre aspas');
  assert(escapeCSVField(null) === '""', 'Valores nulos devem retornar string vazia entre aspas');

  // Teste 2: Geração de CSV com formato correto e BOM UTF-8
  const mockAccounts: Account[] = [
    {
      id: 'acc_br_1',
      userId: 'user_1',
      institutionName: 'Nubank',
      kind: 'checking',
      balance: 5000,
      currency: 'BRL',
      provider: 'open_finance',
      lastSyncedAt: '2026-09-20',
      status: 'connected',
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx_1',
      userId: 'user_1',
      accountId: 'acc_br_1',
      description: 'Supermercado Pão de Açúcar',
      amount: 342.5,
      type: 'expense',
      category: 'Alimentação',
      source: 'auto_import',
      merchant: 'Pão de Açúcar',
      occurredAt: '2026-09-18',
      createdAt: '2026-09-18T12:00:00Z',
    },
    {
      id: 'tx_2',
      userId: 'user_1',
      accountId: 'acc_br_1',
      description: 'Consultoria UI/UX Cliente A',
      amount: 4500.0,
      type: 'income',
      category: 'Salário / Honorários',
      source: 'manual',
      merchant: 'Tech Studio',
      occurredAt: '2026-09-19',
      createdAt: '2026-09-19T14:00:00Z',
    },
  ];

  const csv = generateTransactionsCSV(mockTransactions, mockAccounts, 'BR');

  // Validações estruturais do CSV
  assert(csv.startsWith('\uFEFF'), 'CSV deve iniciar com o Byte Order Mark (BOM) UTF-8 para compatibilidade com Excel');
  assert(csv.includes('Data;Descrição;Tipo;Categoria;Valor;Moeda;Conta;Estabelecimento;Origem do Dado'), 'Cabeçalho deve conter todas as colunas com separador ponto-e-vírgula');
  assert(csv.includes('"Supermercado Pão de Açúcar"'), 'Deve conter descrição do lançamento');
  assert(csv.includes('"342.50"'), 'Valor da despesa deve ter duas casas decimais');
  assert(csv.includes('"BRL"'), 'Moeda para Brasil deve ser BRL');
  assert(csv.includes('"Nubank (checking)"'), 'Nome da conta e tipo devem ser vinculados');
  assert(csv.includes('"Importação Automática"'), 'Origem do dado auto_import deve ser mapeada');
  assert(csv.includes('"Consultoria UI/UX Cliente A"'), 'Lançamento de receita deve estar presente');
  assert(csv.includes('"Receita"'), 'Tipo income deve ser traduzido para Receita');
  assert(csv.includes('"Despesa"'), 'Tipo expense deve ser traduzido para Despesa');

  // Teste 3: Moeda de Angola
  const csvAO = generateTransactionsCSV(mockTransactions, mockAccounts, 'AO');
  assert(csvAO.includes('"AOA"'), 'Moeda para Angola deve ser AOA');

  console.log('\n🎉 TODOS OS TESTES DE EXPORTAÇÃO CSV PASSARAM COM SUCESSO!\n');
}

runExportTests();
