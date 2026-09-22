/**
 * Testes automatizados das Regras de Negócio do Prumo (Definição de Pronto - MVP)
 * Cobre:
 * 1. Cálculo de saldo agregado
 * 2. Cálculo de totais e taxa de poupança (savings rate)
 * 3. Lógica de status de orçamento (dentro/atenção/acima do limite)
 * 4. Lógica de projeção de cenários de 24 meses
 * 5. Geração de alertas preditivos
 */

import {
  calculateAggregatedBalance,
  calculateTotals,
  calculateBudgetStatus,
  projectScenarios,
  generatePredictiveAlerts,
  formatCurrency,
} from '../src/services/businessRules';
import { Account, Transaction, ScenarioEvent, UserProfile, BudgetLimit } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Test Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

function runTests() {
  console.log('\n--- 🧪 Iniciando Testes de Regras de Negócio do Prumo ---\n');

  // Teste 1: Cálculo de saldo agregado
  const sampleAccounts: Account[] = [
    {
      id: 'acc-1',
      userId: 'user-1',
      provider: 'open_finance',
      institutionName: 'Nubank',
      kind: 'checking',
      balance: 4500.5,
      currency: 'BRL',
      lastSyncedAt: new Date().toISOString(),
      status: 'connected',
    },
    {
      id: 'acc-2',
      userId: 'user-1',
      provider: 'manual',
      institutionName: 'BFA Angola',
      kind: 'savings',
      balance: 125000,
      currency: 'AOA',
      lastSyncedAt: new Date().toISOString(),
      status: 'manual',
    },
  ];

  const totalBalance = calculateAggregatedBalance(sampleAccounts);
  assert(totalBalance === 129500.5, 'Cálculo de saldo agregado deve somar todas as contas');

  // Teste 2: Cálculo de totais e taxa de poupança
  const sampleTransactions: Transaction[] = [
    {
      id: 't-1',
      userId: 'user-1',
      amount: 10000,
      type: 'income',
      category: 'Salário / Honorários',
      description: 'Honorários Projeto UX',
      source: 'manual',
      occurredAt: '2026-09-05',
      createdAt: '2026-09-05',
    },
    {
      id: 't-2',
      userId: 'user-1',
      amount: 3000,
      type: 'expense',
      category: 'Moradia',
      description: 'Aluguel',
      source: 'manual',
      occurredAt: '2026-09-10',
      createdAt: '2026-09-10',
    },
    {
      id: 't-3',
      userId: 'user-1',
      amount: 1000,
      type: 'expense',
      category: 'Alimentação',
      description: 'Supermercado',
      source: 'manual',
      occurredAt: '2026-09-15',
      createdAt: '2026-09-15',
    },
  ];

  const totals = calculateTotals(sampleTransactions);
  assert(totals.totalIncome === 10000, 'Total de receitas deve ser 10.000');
  assert(totals.totalExpense === 4000, 'Total de despesas deve ser 4.000');
  assert(totals.netSavings === 6000, 'Poupança líquida deve ser 6.000');
  assert(totals.savingsRate === 0.6, 'Taxa de poupança deve ser 60% (0.6)');

  // Teste 3: Status de orçamento
  // Limite: 1000
  // Gasto: 500 (50%) -> within
  const statusWithin = calculateBudgetStatus(500, 1000);
  assert(statusWithin.status === 'within', '50% do limite deve ser status "within"');
  assert(statusWithin.remaining === 500, 'Margem restante deve ser 500');

  // Gasto: 850 (85%) -> warning
  const statusWarning = calculateBudgetStatus(850, 1000);
  assert(statusWarning.status === 'warning', '85% do limite deve ser status "warning"');

  // Gasto: 1100 (110%) -> exceeded
  const statusExceeded = calculateBudgetStatus(1100, 1000);
  assert(statusExceeded.status === 'exceeded', '110% do limite deve ser status "exceeded"');
  assert(statusExceeded.remaining === 0, 'Margem restante quando estourado deve ser 0');

  // Teste 4: Projeção de cenários de 24 meses
  const events: ScenarioEvent[] = [
    {
      id: 'evt-1',
      label: 'Novo Cliente Recorrente',
      description: 'Renda extra mensal',
      type: 'income',
      monthlyDelta: 2000,
      startMonth: 3,
      enabled: true,
      category: 'Salário / Honorários',
    },
    {
      id: 'evt-2',
      label: 'Novo Laptop',
      description: 'Custo pontual',
      type: 'expense',
      monthlyDelta: 0,
      oneTimeCost: 5000,
      startMonth: 2,
      enabled: true,
      category: 'Equipamentos & Trabalho',
    },
    {
      id: 'evt-3',
      label: 'Evento Desabilitado',
      description: 'Não deve afetar',
      type: 'expense',
      monthlyDelta: 10000,
      startMonth: 1,
      enabled: false,
      category: 'Outros',
    },
  ];

  const projections = projectScenarios(
    10000, // saldo inicial
    8000,  // renda mensal base
    5000,  // despesa mensal base (sobra base = 3000/mês)
    events,
    24
  );

  assert(projections.length === 24, 'Deve projetar exatamente 24 meses');

  // Mês 1: sem eventos ativos -> baseline = 10k + 3k = 13k, cenário = 13k
  assert(projections[0].baselineBalance === 13000, 'Mês 1 baseline deve ser 13.000');
  assert(projections[0].scenarioBalance === 13000, 'Mês 1 cenário deve ser 13.000');

  // Mês 2: evento de laptop (-5000 pontual)
  // Baseline = 13k + 3k = 16k
  // Cenário = 13k + 3k - 5000 = 11k
  assert(projections[1].baselineBalance === 16000, 'Mês 2 baseline deve ser 16.000');
  assert(projections[1].scenarioBalance === 11000, 'Mês 2 cenário deve absorver custo pontual de 5.000');

  // Mês 24: renda extra de 2000 ativa do mês 3 até 24 (22 meses * 2000 = +44.000) menos laptop 5.000 = +39.000 de delta
  const month24 = projections[23];
  assert(month24.deltaNet === 39000, `Delta no mês 24 deve ser exatamente +39.000 (recebido: ${month24.deltaNet})`);

  // Teste 5: Geração de Alertas Preditivos
  const freelancerProfile: UserProfile = {
    profession: 'Designer Freelancer',
    primaryGoal: 'Reserva e Viagem',
    goalTargetValue: 20000,
    goalSavedValue: 20000, // 100% atingido
    goalDeadline: '2026-12',
    monthlyIncomeExpectation: 8000,
  };

  const limits: BudgetLimit[] = [
    { id: 'b-1', userId: 'user-1', category: 'Alimentação', monthlyLimit: 500 }, // gasto foi 1000 -> estourado!
  ];

  const alerts = generatePredictiveAlerts(freelancerProfile, sampleAccounts, sampleTransactions, limits);
  const hasExceededAlert = alerts.some((a) => a.type === 'budget_exceeded');
  const hasGoalAlert = alerts.some((a) => a.type === 'goal_progress');

  assert(hasExceededAlert, 'Deve gerar alerta de orçamento excedido para Alimentação');
  assert(hasGoalAlert, 'Deve gerar alerta de comemoração de meta alcançada');

  // Teste 6: Formatação de Moeda
  const brl = formatCurrency(1250.5, 'BR');
  const aoa = formatCurrency(1250.5, 'AO');
  assert(brl.includes('R$'), 'Formatação BR deve conter R$');
  assert(aoa.includes('Kz'), 'Formatação AO deve conter Kz');

  console.log('\n🎉 TODOS OS 12 TESTES DE REGRAS DE NEGÓCIO PASSARAM COM SUCESSO!\n');
}

runTests();
