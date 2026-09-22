/**
 * Testes automatizados do Módulo de Persistência Local (Offline-First) do Prumo
 */

import {
  getDefaultCountryState,
  classifyOffline,
  saveOfflineTransaction,
  CountryDataState,
} from '../src/services/storageService';
import { Transaction } from '../src/types';

// Mock simples de localStorage para ambiente Node.js de teste
const storageMap: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => storageMap[key] || null,
  setItem: (key: string, val: string) => {
    storageMap[key] = val;
  },
  removeItem: (key: string) => {
    delete storageMap[key];
  },
  clear: () => {
    Object.keys(storageMap).forEach((k) => delete storageMap[k]);
  },
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Test Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

function runStorageTests() {
  console.log('\n--- 🧪 Iniciando Testes de Persistência Local & Offline ---\n');

  // Teste 1: Estado padrão do Brasil
  const stateBR = getDefaultCountryState('BR');
  assert(stateBR.user.country === 'BR', 'Estado padrão BR deve ter país BR');
  assert(stateBR.transactions.length > 0, 'Estado padrão BR deve conter transações iniciais');
  assert(stateBR.accounts.length > 0, 'Estado padrão BR deve conter contas');
  assert(stateBR.budgetLimits.length > 0, 'Estado padrão BR deve conter orçamentos');

  // Teste 2: Estado padrão de Angola
  const stateAO = getDefaultCountryState('AO');
  assert(stateAO.user.country === 'AO', 'Estado padrão AO deve ter país AO');
  assert(stateAO.transactions.length > 0, 'Estado padrão AO deve conter transações iniciais');
  assert(stateAO.accounts.some((a) => a.currency === 'AOA' && a.provider === 'manual'), 'Estado padrão AO deve ter contas em AOA com fluxo manual');

  // Teste 3: Classificador inteligente offline (sem rede)
  const catUber = classifyOffline('Uber para o escritório');
  assert(catUber.category === 'Transporte', `Uber deve ser Transporte (recebido: ${catUber.category})`);

  const catKero = classifyOffline('Compras semanais Hipermercado Kero');
  assert(catKero.category === 'Alimentação', `Kero deve ser Alimentação (recebido: ${catKero.category})`);

  const catEnde = classifyOffline('Conta de energia ENDE');
  assert(catEnde.category === 'Moradia', `ENDE deve ser Moradia (recebido: ${catEnde.category})`);

  const catHonorarios = classifyOffline('Honorários cliente consultoria');
  assert(catHonorarios.category === 'Salário / Honorários', `Honorários deve ser Salário / Honorários`);

  // Teste 4: Registro de transação offline com atualização de saldo
  const initialBR = getDefaultCountryState('BR');
  const targetAcc = initialBR.accounts[0];
  const initialBalance = targetAcc.balance;

  const offlineExpense: Transaction = {
    id: 'tx_offline_test_1',
    userId: 'user-br-1',
    accountId: targetAcc.id,
    description: 'Café da tarde padaria',
    amount: 50,
    type: 'expense',
    category: 'Alimentação',
    source: 'manual',
    occurredAt: '2026-10-15',
    createdAt: '2026-10-15T15:00:00Z',
  };

  const updatedState = saveOfflineTransaction('BR', offlineExpense);
  assert(updatedState.transactions.some((t) => t.id === 'tx_offline_test_1'), 'Transação offline deve estar na lista');
  assert(Boolean(updatedState.offlineQueue?.some((t) => t.id === 'tx_offline_test_1')), 'Transação offline deve estar na fila de sincronização');
  
  const updatedAcc = updatedState.accounts.find((a) => a.id === targetAcc.id);
  assert(
    updatedAcc?.balance === initialBalance - 50,
    `Saldo da conta deve ter sido debitado em 50 (esperado: ${initialBalance - 50}, recebido: ${updatedAcc?.balance})`
  );

  console.log('\n🎉 TODOS OS TESTES DE PERSISTÊNCIA LOCAL PASSARAM COM SUCESSO!\n');
}

runStorageTests();
