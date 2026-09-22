/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Country,
  User,
  Account,
  Transaction,
  BudgetLimit,
  ScenarioEvent,
  Goal,
  ChatMessage,
  UserProfile,
  FinancialSnapshot,
} from './types';
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
} from './data/mockData';
import {
  calculateAggregatedBalance,
  calculateTotals,
  analyzeBudgets,
  generatePredictiveAlerts,
} from './services/businessRules';
import { getAccountAggregator } from './services/accountAggregator';

// Subcomponents
import { Header } from './components/Header';
import { Navigation, TabKey } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { BudgetsGoalsView } from './components/BudgetsGoalsView';
import { ScenarioSimulatorView } from './components/ScenarioSimulatorView';
import { AccountsView } from './components/AccountsView';
import { CopilotChatView } from './components/CopilotChatView';
import { ProfileModal } from './components/ProfileModal';
import {
  loadCountryData,
  saveCountryData,
  resetCountryData,
  getStoredActiveCountry,
  setStoredActiveCountry,
  getStoredTheme,
  setStoredTheme,
} from './services/storageService';

export default function App() {
  // 1. Country & Theme
  const [country, setCountry] = useState<Country>(() => getStoredActiveCountry());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getStoredTheme() === 'dark');

  // Network Status (Online / Offline detection)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Active Tab
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // 3. Modals
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // 4. State Storage (carregado diretamente do LocalStorage do país ativo)
  const [user, setUser] = useState<User>(() => loadCountryData(getStoredActiveCountry()).user);
  const [accounts, setAccounts] = useState<Account[]>(() => loadCountryData(getStoredActiveCountry()).accounts);
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadCountryData(getStoredActiveCountry()).transactions);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>(() => loadCountryData(getStoredActiveCountry()).budgetLimits);
  const [scenarioEvents, setScenarioEvents] = useState<ScenarioEvent[]>(() => loadCountryData(getStoredActiveCountry()).scenarioEvents);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadCountryData(getStoredActiveCountry()).chatMessages);
  const [goals, setGoals] = useState<Goal[]>(() => loadCountryData(getStoredActiveCountry()).goals || []);

  // Persistir automaticamente qualquer alteração no LocalStorage
  useEffect(() => {
    saveCountryData(country, {
      user,
      accounts,
      transactions,
      budgetLimits,
      scenarioEvents,
      chatMessages,
      goals,
      lastSavedAt: new Date().toISOString(),
    });
  }, [country, user, accounts, transactions, budgetLimits, scenarioEvents, chatMessages, goals]);

  // Apply dark mode class to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      setStoredTheme(next ? 'dark' : 'light');
      return next;
    });
  };

  // Handler de troca de país (Brasil vs Angola) com preservação de estado em ambos
  const handleCountryChange = (newCountry: Country) => {
    if (newCountry === country) return;

    // Salvar estado do país atual antes da troca
    saveCountryData(country, {
      user,
      accounts,
      transactions,
      budgetLimits,
      scenarioEvents,
      chatMessages,
      goals,
      lastSavedAt: new Date().toISOString(),
    });

    setCountry(newCountry);
    setStoredActiveCountry(newCountry);

    // Carregar estado persistido do novo país
    const nextData = loadCountryData(newCountry);
    setUser(nextData.user);
    setAccounts(nextData.accounts);
    setTransactions(nextData.transactions);
    setBudgetLimits(nextData.budgetLimits);
    setScenarioEvents(nextData.scenarioEvents);
    setChatMessages(nextData.chatMessages);
    setGoals(nextData.goals || []);
  };

  // Reset dados para o padrão do país atual
  const handleResetData = () => {
    const defaultData = resetCountryData(country);
    setUser(defaultData.user);
    setAccounts(defaultData.accounts);
    setTransactions(defaultData.transactions);
    setBudgetLimits(defaultData.budgetLimits);
    setScenarioEvents(defaultData.scenarioEvents);
    setChatMessages(defaultData.chatMessages);
    setGoals(defaultData.goals || []);
  };

  // Profile Save
  const handleSaveProfile = (updatedProfile: UserProfile, newCountry: Country, name: string) => {
    setUser((prev) => ({
      ...prev,
      name,
      country: newCountry,
      profile: updatedProfile,
    }));
    if (newCountry !== country) {
      handleCountryChange(newCountry);
    }
  };

  // 2FA Toggle
  const handleToggle2FA = () => {
    setUser((prev) => ({
      ...prev,
      twoFactorEnabled: !prev.twoFactorEnabled,
    }));
  };

  // Transações CRUD
  const handleAddTransaction = (newTx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const created: Transaction = {
      ...newTx,
      id: `tx_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [created, ...prev]);

    // Se tiver conta associada, atualizar o saldo da conta
    if (newTx.accountId) {
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id === newTx.accountId) {
            const delta = newTx.type === 'income' ? newTx.amount : -newTx.amount;
            return { ...acc, balance: acc.balance + delta };
          }
          return acc;
        })
      );
    }
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Orçamentos e Metas
  const handleUpdateBudgetLimit = (id: string, newLimit: number) => {
    setBudgetLimits((prev) =>
      prev.map((b) => (b.id === id ? { ...b, monthlyLimit: newLimit } : b))
    );
  };

  const handleAddBudgetLimit = (category: string, monthlyLimit: number) => {
    const newLimit: BudgetLimit = {
      id: `bd_${Date.now()}`,
      userId: user.id,
      category,
      monthlyLimit,
    };
    setBudgetLimits((prev) => [...prev, newLimit]);
  };

  const handleAddSavedAmountToPrimaryGoal = (amount: number) => {
    setUser((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        goalSavedValue: (prev.profile.goalSavedValue || 0) + amount,
      },
    }));
  };

  const handleAddGoal = (goal: Omit<Goal, 'id'>) => {
    const created: Goal = {
      ...goal,
      id: `goal_${Date.now()}`,
    };
    setGoals((prev) => [...prev, created]);
  };

  // Eventos de Cenário
  const handleToggleScenarioEvent = (id: string) => {
    setScenarioEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    );
  };

  const handleAddScenarioEvent = (evt: Omit<ScenarioEvent, 'id'>) => {
    const created: ScenarioEvent = {
      ...evt,
      id: `sc_evt_${Date.now()}`,
    };
    setScenarioEvents((prev) => [...prev, created]);
  };

  const handleDeleteScenarioEvent = (id: string) => {
    setScenarioEvents((prev) => prev.filter((e) => e.id !== id));
  };

  // Contas & Open Finance
  const handleConnectAccount = (account: Account) => {
    setAccounts((prev) => [...prev, account]);
  };

  const handleSyncAccount = async (accountId: string) => {
    const aggregator = getAccountAggregator(country);
    const newTransactions = await aggregator.syncTransactions(accountId);
    if (newTransactions.length > 0) {
      setTransactions((prev) => [...newTransactions, ...prev]);
    }
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, lastSyncedAt: new Date().toISOString() } : a
      )
    );
  };

  const handleDeleteAccount = (accountId: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  };

  // Copiloto Chat
  const handleSendMessage = async (userPrompt: string) => {
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      userId: user.id,
      role: 'user',
      content: userPrompt,
      createdAt: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);

    const aggregatedBalance = calculateAggregatedBalance(accounts);

    // Se estiver offline, responder imediatamente com o estado local seguro
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      const offlineMsg: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        userId: user.id,
        role: 'assistant',
        content: `Você está operando em **Modo Offline** sem conexão à internet no momento.

Seus dados financeiros, saldo agregado (${country === 'BR' ? 'R$' : 'Kz'} ${aggregatedBalance.toLocaleString()}), transações e limites de orçamento estão totalmente salvos no armazenamento local do seu dispositivo.

Todas as ferramentas do Prumo — incluindo registro de lançamentos, verificação de orçamentos e simulações de cenários de 24 meses — continuam operando de forma autônoma. Assim que a sua conexão retornar, poderei gerar respostas contextuais com IA em tempo real.`,
        createdAt: new Date().toISOString(),
        suggestedAction: {
          label: 'Ver Orçamentos',
          actionType: 'view_budget',
        },
      };
      setChatMessages((prev) => [...prev, offlineMsg]);
      return;
    }

    // Montar Retrato financeiro atual do usuário
    const { totalIncome, totalExpense, netSavings, savingsRate } = calculateTotals(transactions);
    const budgetAnalysis = analyzeBudgets(budgetLimits, transactions);
    const predictiveAlerts = generatePredictiveAlerts(user.profile, accounts, transactions, budgetLimits);

    const snapshot: FinancialSnapshot = {
      user: {
        name: user.name,
        profession: user.profile.profession,
        country: user.country,
        primaryGoal: user.profile.primaryGoal,
        goalTargetValue: user.profile.goalTargetValue,
        goalSavedValue: user.profile.goalSavedValue,
        goalDeadline: user.profile.goalDeadline,
      },
      aggregatedBalance,
      connectedAccountsCount: accounts.length,
      currentMonth: {
        totalIncome,
        totalExpense,
        netSavings,
        savingsRate,
      },
      past90DaysByCategory: {},
      budgets: budgetAnalysis,
      activeScenarioSummary: {
        enabledEventsCount: scenarioEvents.filter((e) => e.enabled).length,
        month24Baseline: 0,
        month24Scenario: 0,
        difference: 0,
      },
    };

    try {
      const res = await fetch('/api/copiloto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userPrompt,
          snapshot,
          history: chatMessages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        userId: user.id,
        role: 'assistant',
        content: data.reply || 'Desculpe, não consegui processar a resposta agora.',
        createdAt: new Date().toISOString(),
        suggestedAction: data.suggestedAction || undefined,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Erro na resposta do Copiloto:', err);
      const fallbackMsg: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        userId: user.id,
        role: 'assistant',
        content:
          'Tivemos uma instabilidade momentânea na conexão com o copiloto. Seus dados continuam seguros localmente.',
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    }
  };

  // Cálculos para o simulador
  const initialBalance = useMemo(() => calculateAggregatedBalance(accounts), [accounts]);
  const { totalIncome, totalExpense } = useMemo(() => calculateTotals(transactions), [transactions]);
  const predictiveAlerts = useMemo(
    () => generatePredictiveAlerts(user.profile, accounts, transactions, budgetLimits),
    [user.profile, accounts, transactions, budgetLimits]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors">
      {/* Top Header */}
      <Header
        user={user}
        currentCountry={country}
        onCountryChange={handleCountryChange}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onOpenProfile={() => setIsProfileOpen(true)}
        onResetData={handleResetData}
        isOnline={isOnline}
      />

      {/* Main Tab Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        unreadAlertsCount={predictiveAlerts.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'overview' && (
          <DashboardView
            user={user}
            country={country}
            accounts={accounts}
            transactions={transactions}
            budgetLimits={budgetLimits}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenNewTransaction={() => setActiveTab('transactions')}
            onOpenConnectAccount={() => setActiveTab('accounts')}
            isOnline={isOnline}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            accounts={accounts}
            country={country}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            isOnline={isOnline}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetsGoalsView
            user={user}
            budgetLimits={budgetLimits}
            transactions={transactions}
            country={country}
            goals={goals}
            onUpdateBudgetLimit={handleUpdateBudgetLimit}
            onAddBudgetLimit={handleAddBudgetLimit}
            onAddSavedAmountToPrimaryGoal={handleAddSavedAmountToPrimaryGoal}
            onAddGoal={handleAddGoal}
          />
        )}

        {activeTab === 'scenarios' && (
          <ScenarioSimulatorView
            user={user}
            initialBalance={initialBalance}
            baseMonthlyIncome={totalIncome > 0 ? totalIncome : user.profile.monthlyIncomeExpectation}
            baseMonthlyExpense={totalExpense > 0 ? totalExpense : 3000}
            country={country}
            events={scenarioEvents}
            onToggleEvent={handleToggleScenarioEvent}
            onAddEvent={handleAddScenarioEvent}
            onDeleteEvent={handleDeleteScenarioEvent}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            user={user}
            country={country}
            accounts={accounts}
            onConnectAccount={handleConnectAccount}
            onSyncAccount={handleSyncAccount}
            onDeleteAccount={handleDeleteAccount}
            onToggle2FA={handleToggle2FA}
          />
        )}

        {activeTab === 'copilot' && (
          <CopilotChatView
            user={user}
            country={country}
            accounts={accounts}
            transactions={transactions}
            budgetLimits={budgetLimits}
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            onNavigateTab={(tab) => setActiveTab(tab)}
            isOnline={isOnline}
          />
        )}
      </main>

      {/* Profile / Calibration Modal */}
      <ProfileModal
        user={user}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onSaveProfile={handleSaveProfile}
        onToggle2FA={handleToggle2FA}
      />
    </div>
  );
}
