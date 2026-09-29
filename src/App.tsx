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
  RecurrenceRule,
  CategoryAllocation,
  Notification,
} from './types';
import {
  calculateAggregatedBalance,
  calculateTotals,
  analyzeBudgets,
  generatePredictiveAlerts,
} from './services/businessRules';
import { getAccountAggregator } from './services/accountAggregator';
import { materializeRecurringTransactions } from './services/recurrenceEngine';
import {
  deriveNotifications,
  countUnread,
  markAllRead,
  reconcileNotifications,
} from './services/notificationService';

// Subcomponents
import { Header } from './components/Header';
import { NotificationCenter } from './components/NotificationCenter';
import { SharedSpaceCard } from './components/SharedSpaceCard';
import { Navigation, TabKey } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { BudgetsGoalsView } from './components/BudgetsGoalsView';
import { ScenarioSimulatorView } from './components/ScenarioSimulatorView';
import { AccountsView } from './components/AccountsView';
import { CopilotChatView } from './components/CopilotChatView';
import { OfxImportModal } from './components/OfxImportModal';
import { RecurrenceManagerModal } from './components/RecurrenceManagerModal';
import { MonthlyReportModal } from './components/MonthlyReportModal';
import { ProfileModal } from './components/ProfileModal';
import { LoginView } from './components/LoginView';
import {
  loadCountryData,
  saveCountryData,
  resetCountryData,
  createNewUser,
  getEmptyCountryState,
  getStoredActiveCountry,
  setStoredActiveCountry,
  getStoredTheme,
  setStoredTheme,
  type StorageOwner,
} from './services/storageService';
import { OnboardingWizard, type OnboardingResult } from './components/OnboardingWizard';
import { SalesFunnelView } from './components/SalesFunnelView';
import { fetchAccess, fetchIsAdmin, confirmPayment, type AccessInfo } from './services/accessService';
import { AdminView } from './components/AdminView';
import { PlumbLine } from './components/PlumbLine';
import {
  fetchMe,
  logout as authLogout,
  exportMyData,
  deleteMyAccount,
  type AuthUser,
} from './services/authService';
import { pushState, pullState, type SyncStatus } from './services/syncService';
import { Info, Lock, Compass } from 'lucide-react';

/** Chave 'YYYY-MM' do mês corrente (fuso local) — alocações por categoria. */
function getMonthKeyLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Mensagem de boas-vindas do copiloto: sempre com os dados REAIS do usuário
 * (nome, contas cadastradas e meta), nunca números fictícios.
 */
function buildWelcomeMessage(
  name: string,
  country: Country,
  accounts: Account[],
  primaryGoal: string
): ChatMessage {
  const hasAccounts = accounts.length > 0;
  const balance = calculateAggregatedBalance(accounts);
  const currency = country === 'BR' ? 'R$' : 'Kz';
  const balanceLine = hasAccounts
    ? `Seu saldo inicial registrado é de **${currency} ${balance.toLocaleString(country === 'BR' ? 'pt-BR' : 'pt-AO')}** em ${accounts.length} conta(s).`
    : 'Você ainda não cadastrou contas — dá para adicionar quando quiser na aba **Contas**.';

  return {
    id: `msg_welcome_${Date.now()}`,
    userId: 'current-user',
    role: 'assistant',
    content: `Olá, ${name || 'tudo bem'}! Sou o Prumo, seu copiloto financeiro. ${balanceLine}

Sua meta atual é **${primaryGoal || 'organizar suas finanças'}**. Para eu te ajudar de verdade, o próximo passo é registrar seus lançamentos — cada lançamento melhora as análises, os alertas e as projeções.

Por onde quer começar?`,
    createdAt: new Date().toISOString(),
    suggestedAction: hasAccounts
      ? { label: 'Registrar primeiro lançamento', actionType: 'add_transaction' }
      : { label: 'Adicionar conta', actionType: 'view_budget' },
  };
}

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

  // 2.1 Autenticação & Sync (Neon)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'checking' | 'guest' | 'authed' | 'demo'>('checking');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');

  // 3. Modals
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pendingOnboarding, setPendingOnboarding] = useState(false);

  // 3.1 Paywall (Fase 5): estado de acesso da conta real. null = ainda não
  // carregado/falha de rede → degrade aberto (nunca bloquear por bug).
  const [access, setAccess] = useState<AccessInfo | null>(null);
  // Painel Admin (Fase A): flag do /me — decisão de exibição; autorização real é server-side.
  const [isAdmin, setIsAdmin] = useState(false);
  const [funnelQuiz, setFunnelQuiz] = useState<{
    monthlyIncome?: number;
    primaryGoal?: string;
    goalTargetValue?: number;
    accountsCount: number;
  }>({ accountsCount: 0 });

  // 4. State Storage (LocalStorage por país; contas reais com estado vazio)
  const storageOwner: StorageOwner = useMemo(
    () => ({
      userId: authStatus === 'authed' && authUser ? authUser.id : null,
      name: authUser?.name,
      email: authUser?.email,
    }),
    [authStatus, authUser]
  );

  const [user, setUser] = useState<User>(() => loadCountryData(getStoredActiveCountry()).user);
  const [accounts, setAccounts] = useState<Account[]>(() => loadCountryData(getStoredActiveCountry()).accounts);
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadCountryData(getStoredActiveCountry()).transactions);
  const [budgetLimits, setBudgetLimits] = useState<BudgetLimit[]>(() => loadCountryData(getStoredActiveCountry()).budgetLimits);
  const [scenarioEvents, setScenarioEvents] = useState<ScenarioEvent[]>(() => loadCountryData(getStoredActiveCountry()).scenarioEvents);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadCountryData(getStoredActiveCountry()).chatMessages);
  const [goals, setGoals] = useState<Goal[]>(() => loadCountryData(getStoredActiveCountry()).goals || []);
  const [recurrenceRules, setRecurrenceRules] = useState<RecurrenceRule[]>(
    () => loadCountryData(getStoredActiveCountry()).recurrenceRules || []
  );
  const [categoryAllocations, setCategoryAllocations] = useState<CategoryAllocation[]>(
    () => loadCountryData(getStoredActiveCountry()).categoryAllocations || []
  );
  const [notifications, setNotifications] = useState<Notification[]>(
    () => loadCountryData(getStoredActiveCountry()).notifications || []
  );

  // Modais da Fase 1: recorrências, importação OFX e relatório mensal
  const [isRecurrenceOpen, setIsRecurrenceOpen] = useState(false);
  const [isOfxOpen, setIsOfxOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Aplicar o seed correto quando a sessão é resolvida: conta real → estado
  // vazio próprio; restauração de sessão existente → estado salvo do usuário.
  const [seedAppliedFor, setSeedAppliedFor] = useState<string | null>(null);
  useEffect(() => {
    if (authStatus === 'checking') return;
    const ownerId = storageOwner.userId || 'demo';
    if (seedAppliedFor === ownerId) return;
    setSeedAppliedFor(ownerId);
    if (authStatus === 'authed' && authUser) {
      // Sessão restaurada ao abrir: puxa o estado salvo no servidor; se não
      // houver (conta nova), começa com estado vazio (sem nada fictício).
      (async () => {
        const pulled = await pullState();
        if (pulled?.state && typeof pulled.state === 'object') {
          applyServerState(pulled.state, authUser.country);
          setSyncStatus('synced');
        } else {
          const fresh = loadCountryData(authUser.country, storageOwner);
          setUser(fresh.user);
          setAccounts(fresh.accounts);
          setTransactions(fresh.transactions);
          setBudgetLimits(fresh.budgetLimits);
          setScenarioEvents(fresh.scenarioEvents);
          setChatMessages(fresh.chatMessages);
          setGoals(fresh.goals || []);
          setRecurrenceRules(fresh.recurrenceRules || []);
          setCategoryAllocations(fresh.categoryAllocations || []);
          setNotifications(fresh.notifications || []);
          setCountry(authUser.country);
          setStoredActiveCountry(authUser.country);
        }
      })();
    } else if (authStatus === 'demo') {
      const demo = loadCountryData(country); // sem userId → mock do país
      setUser(demo.user);
      setAccounts(demo.accounts);
      setTransactions(demo.transactions);
      setBudgetLimits(demo.budgetLimits);
      setScenarioEvents(demo.scenarioEvents);
      setChatMessages(demo.chatMessages);
      setGoals(demo.goals || []);
      setRecurrenceRules(demo.recurrenceRules || []);
      setCategoryAllocations(demo.categoryAllocations || []);
      setNotifications(demo.notifications || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, seedAppliedFor]);

  // Persistir automaticamente qualquer alteração no LocalStorage (escopo: dono atual)
  useEffect(() => {
    saveCountryData(country, {
      user,
      accounts,
      transactions,
      budgetLimits,
      scenarioEvents,
      chatMessages,
      goals,
      recurrenceRules,
      categoryAllocations,
      notifications,
      lastSavedAt: new Date().toISOString(),
    }, storageOwner.userId);
  }, [country, user, accounts, transactions, budgetLimits, scenarioEvents, chatMessages, goals, recurrenceRules, categoryAllocations, notifications, storageOwner.userId]);

  // Aplica estado vindo do servidor (restauro em novo dispositivo/login)
  const applyServerState = (serverState: unknown, targetCountry: Country) => {
    if (!serverState || typeof serverState !== 'object') return;
    const s = serverState as Record<string, unknown>;
    const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

    setCountry(targetCountry);
    setStoredActiveCountry(targetCountry);

    const serverUser = (s.user && typeof s.user === 'object' ? s.user : {}) as Partial<User>;
    setUser((prev) => ({ ...prev, ...serverUser, country: targetCountry }));
    setAccounts(arr<Account>(s.accounts));
    setTransactions(arr<Transaction>(s.transactions));
    setBudgetLimits(arr<BudgetLimit>(s.budgetLimits));
    setScenarioEvents(arr<ScenarioEvent>(s.scenarioEvents));
    setChatMessages(arr<ChatMessage>(s.chatMessages));
    setGoals(arr<Goal>(s.goals));
    setRecurrenceRules(arr<RecurrenceRule>(s.recurrenceRules));
    setCategoryAllocations(arr<CategoryAllocation>(s.categoryAllocations));
    setNotifications(arr<Notification>(s.notifications));
  };

  // Restaura sessão existente (cookie httpOnly) ao carregar o app.
  // O seed/pull do estado é feito no efeito de seed (acima) quando authStatus muda.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetchMe();
      if (cancelled) return;
      if (me) {
        setAuthUser(me);
        setAuthStatus('authed');
        // Paywall (Fase 5): estado de acesso vem no mesmo /me.
        fetchAccess().then((a) => {
          if (!cancelled) setAccess(a);
        });
        // Painel Admin: flag para exibir a tab (autorização real é server-side).
        fetchIsAdmin().then((v) => {
          if (!cancelled) setIsAdmin(v);
        });
        // Volta do checkout Stripe: /?pagamento=ok&session_id=cs_...
        const params = new URLSearchParams(window.location.search);
        if (params.get('pagamento') === 'ok') {
          const sessionId = params.get('session_id');
          window.history.replaceState({}, '', window.location.pathname);
          if (sessionId) {
            confirmPayment(sessionId).then((res) => {
              if (res.ok) {
                fetchAccess().then((a) => {
                  if (!cancelled) setAccess(a);
                });
              } else {
                console.error('Confirmação de pagamento falhou:', res.error);
              }
            });
          }
        }
      } else {
        setAuthStatus('guest');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Modo demonstração: sessão verificada mas sem conta (dados só locais)
  const isDemoMode = authStatus === 'demo';

  // Pós-login/registro: restaura estado do servidor, marca o onboarding pendente
  // e aciona o auto-push para persistir o estado vazio do usuário novo.
  const handleAuthSuccess = async (account: AuthUser, justRegistered: boolean) => {
    setAuthUser(account);
    setAuthStatus('authed');
    // Paywall (Fase 5): carrega o estado de acesso da conta recém-autenticada.
    fetchAccess().then((a) => setAccess(a));
    // Painel Admin: flag de exibição da tab.
    fetchIsAdmin().then((v) => setIsAdmin(v));
    if (justRegistered) {
      // Conta recém-criada: estado vazio com a identidade real (sem mock).
      const freshUser: User = {
        ...createNewUser(account.name, account.email, account.country),
        id: account.id,
      };
      const empty = getEmptyCountryState(freshUser);
      setUser(empty.user);
      setAccounts(empty.accounts);
      setTransactions(empty.transactions);
      setBudgetLimits(empty.budgetLimits);
      setScenarioEvents(empty.scenarioEvents);
      setChatMessages(empty.chatMessages);
      setGoals(empty.goals);
      setRecurrenceRules([]);
      setCategoryAllocations([]);
      setNotifications([]);
      setCountry(account.country);
      setStoredActiveCountry(account.country);
      setPendingOnboarding(true);
      setSyncStatus('pending');
      return;
    }
    setUser((prev) => ({ ...prev, name: account.name, email: account.email, country: account.country }));
    const pulled = await pullState();
    if (pulled?.state && typeof pulled.state === 'object') {
      applyServerState(pulled.state, account.country);
      setSyncStatus('synced');
      const serverUser = (pulled.state as Record<string, unknown>).user as Partial<User> | undefined;
      setPendingOnboarding(serverUser?.onboardingCompleted === false);
    } else {
      setSyncStatus('pending');
    }
  };

  // Conclusão do onboarding: aplica perfil + contas + orçamentos informados
  // e guarda os dados do quiz para personalizar a oferta do funil (Fase 5).
  const handleOnboardingComplete = (result: OnboardingResult) => {
    setFunnelQuiz({
      monthlyIncome: result.profile.monthlyIncomeExpectation,
      primaryGoal: result.profile.primaryGoal,
      goalTargetValue: result.profile.goalTargetValue,
      accountsCount: result.accounts.length,
    });
    setUser((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...result.profile },
      onboardingCompleted: true,
    }));
    const newAccounts: Account[] = result.accounts.map((a, i) => ({
      ...a,
      id: `acc_${Date.now()}_${i}`,
      userId: user.id,
    }));
    setAccounts(newAccounts);
    setBudgetLimits(
      result.budgetLimits.map((b, i) => ({
        id: `bd_${Date.now()}_${i}`,
        userId: user.id,
        category: b.category,
        monthlyLimit: b.monthlyLimit,
      }))
    );
    setChatMessages([
      buildWelcomeMessage(user.name, user.country, newAccounts, result.profile.primaryGoal),
    ]);
    setPendingOnboarding(false);
    setSyncStatus('pending');
    setActiveTab('overview');
  };

  // Skip do onboarding: marca como completo com perfil mínimo
  const handleOnboardingSkip = () => {
    setUser((prev) => ({
      ...prev,
      onboardingCompleted: true,
      profile: {
        ...prev.profile,
        primaryGoal: prev.profile.primaryGoal || 'Organizar minhas finanças',
      },
    }));
    setChatMessages([
      buildWelcomeMessage(user.name, user.country, [], 'Organizar minhas finanças'),
    ]);
    setPendingOnboarding(false);
    setSyncStatus('pending');
  };

  // Auto-push debounced do estado local para o Neon (quando autenticado e online)
  useEffect(() => {
    if (authStatus !== 'authed' || isDemoMode || !isOnline) return;
    setSyncStatus((prev) => (prev === 'synced' ? 'pending' : prev));
    const timer = setTimeout(async () => {
      const result = await pushState({
        user,
        accounts,
        transactions,
        budgetLimits,
        scenarioEvents,
        chatMessages,
        goals,
        recurrenceRules,
        categoryAllocations,
        notifications,
        lastSavedAt: new Date().toISOString(),
      });
      setSyncStatus(result.ok ? 'synced' : 'error');
    }, 2500);
    return () => clearTimeout(timer);
  }, [authStatus, isOnline, user, accounts, transactions, budgetLimits, scenarioEvents, chatMessages, goals, recurrenceRules, categoryAllocations, notifications]);

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch {
      // sessão já inválida — seguir para o login mesmo assim
    }
    setAuthUser(null);
    setAuthStatus('guest');
    setSyncStatus('local');
    setPendingOnboarding(false);
    setSeedAppliedFor(null);
    setIsAdmin(false);
  };

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
      recurrenceRules,
      categoryAllocations,
      notifications,
      lastSavedAt: new Date().toISOString(),
    }, storageOwner.userId);

    setCountry(newCountry);
    setStoredActiveCountry(newCountry);

    // Carregar estado persistido do novo país
    const nextData = loadCountryData(newCountry, storageOwner);
    setUser(nextData.user);
    setAccounts(nextData.accounts);
    setTransactions(nextData.transactions);
    setBudgetLimits(nextData.budgetLimits);
    setScenarioEvents(nextData.scenarioEvents);
    setChatMessages(nextData.chatMessages);
    setGoals(nextData.goals || []);
    setRecurrenceRules(nextData.recurrenceRules || []);
    setCategoryAllocations(nextData.categoryAllocations || []);
    setNotifications(nextData.notifications || []);
  };

  // Reset dados: conta real zera tudo; demo restaura os dados fictícios
  const handleResetData = () => {
    const defaultData = resetCountryData(country, storageOwner);
    setUser(defaultData.user);
    setAccounts(defaultData.accounts);
    setTransactions(defaultData.transactions);
    setBudgetLimits(defaultData.budgetLimits);
    setScenarioEvents(defaultData.scenarioEvents);
    setChatMessages(defaultData.chatMessages);
    setGoals(defaultData.goals || []);
    setRecurrenceRules(defaultData.recurrenceRules || []);
    setCategoryAllocations(defaultData.categoryAllocations || []);
    setNotifications(defaultData.notifications || []);
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
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [created, ...prev]);

    // Se tiver conta associada, atualizar o saldo da conta — apenas para
    // lançamentos de hoje ou passados (parcelas futuras não debitam agora).
    const todayStr = new Date().toISOString().split('T')[0];
    if (newTx.accountId && created.occurredAt <= todayStr) {
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

  // ─── Recorrências (Fase 1) ───
  const handleAddRecurrenceRule = (rule: Omit<RecurrenceRule, 'id' | 'createdAt'>) => {
    setRecurrenceRules((prev) => [
      ...prev,
      { ...rule, id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString() },
    ]);
  };

  const handleToggleRecurrenceRule = (id: string) => {
    setRecurrenceRules((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  };

  const handleDeleteRecurrenceRule = (id: string) => {
    setRecurrenceRules((prev) => prev.filter((r) => r.id !== id));
  };

  // Materializa lançamentos recorrentes quando as regras mudam (idempotente:
  // o motor nunca duplica ocorrências já existentes).
  useEffect(() => {
    const created = materializeRecurringTransactions(recurrenceRules, transactions, user.id);
    if (created.length > 0) {
      setTransactions((prev) => [...created, ...prev]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurrenceRules]);

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

  // ─── Alocações por categoria — método envelope/YNAB (Fase 3) ───
  const handleAllocateToCategory = (category: string, amount: number) => {
    const monthKey = getMonthKeyLocal();
    setCategoryAllocations((prev) => {
      const idx = prev.findIndex((a) => a.category === category && a.monthKey === monthKey);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], amount: Math.max(0, next[idx].amount + amount) };
        return next;
      }
      return [
        ...prev,
        {
          id: `alloc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: user.id,
          category,
          monthKey,
          amount: Math.max(0, amount),
          createdAt: new Date().toISOString(),
        },
      ];
    });
  };

  const handleClearCategoryAllocation = (category: string) => {
    const monthKey = getMonthKeyLocal();
    setCategoryAllocations((prev) =>
      prev.filter((a) => !(a.category === category && a.monthKey === monthKey))
    );
  };

  const handleAutoAllocateAll = (plan: Array<{ category: string; amount: number }>) => {
    const monthKey = getMonthKeyLocal();
    setCategoryAllocations((prev) => {
      const next = [...prev];
      for (const p of plan) {
        const idx = next.findIndex((a) => a.category === p.category && a.monthKey === monthKey);
        if (idx >= 0) next[idx] = { ...next[idx], amount: p.amount };
        else
          next.push({
            id: `alloc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId: user.id,
            category: p.category,
            monthKey,
            amount: p.amount,
            createdAt: new Date().toISOString(),
          });
      }
      return next;
    });
  };

  // ─── Centro de notificações (Fase 3) ───
  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => markAllRead(prev));
  };

  const handleNotificationNavigate = (tab: NonNullable<Notification['actionTab']>) => {
    setActiveTab(tab);
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

  /** Importação Open Finance real (Pluggy — Fase 4): contas + transações. */
  const handleImportOpenFinance = (imported: Account[], importedTx: Transaction[]) => {
    if (imported.length > 0) {
      setAccounts((prev) => [...prev, ...imported]);
    }
    if (importedTx.length > 0) {
      setTransactions((prev) => [
        ...importedTx.map((t) => ({
          ...t,
          id: `tx_of_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
        })),
        ...prev,
      ]);
    }
    setActiveTab('accounts');
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

  // ─── Notificações derivadas (Fase 3): dedup + persistência de leitura ───
  const derivedNotifs = useMemo(
    () =>
      deriveNotifications({
        userId: user.id,
        country,
        alerts: predictiveAlerts,
        recurrenceRules,
        transactions,
        goals,
        primaryGoal: user.profile.primaryGoal
          ? {
              label: user.profile.primaryGoal,
              targetValue: user.profile.goalTargetValue,
              savedValue: user.profile.goalSavedValue,
              deadline: user.profile.goalDeadline,
            }
          : undefined,
        monthlySavings: totalIncome - totalExpense,
        persisted: notifications,
      }),
    [user.id, user.profile, country, predictiveAlerts, recurrenceRules, transactions, goals, totalIncome, totalExpense, notifications]
  );

  // Concilia com o estado persistido (mantém lidas, descarta condições resolvidas)
  useEffect(() => {
    setNotifications((prev) => {
      const next = reconcileNotifications(derivedNotifs.notifications, derivedNotifs.activeIds, prev);
      // Evita loop de setState: só atualiza se algo mudou de fato
      if (
        next.length === prev.length &&
        next.every((n, i) => n.id === prev[i]?.id && n.readAt === prev[i]?.readAt)
      ) {
        return prev;
      }
      return next;
    });
    // derivedNotifs muda a cada render de dados; notifications muda com este efeito
    // (protegido contra loop pela comparação acima).
  }, [derivedNotifs]);

  const unreadNotifications = useMemo(() => countUnread(notifications), [notifications]);

  // ─── Gate de autenticação ───
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--text)] gap-2 relative overflow-hidden">
        <PlumbLine height={280} country={country} className="absolute inset-0 opacity-60" />
        <div className="relative flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-sm animate-pulse"
            style={{ boxShadow: '0 0 28px var(--gold-glow)' }}
          >
            <Compass className="w-7 h-7" />
          </div>
          <p className="text-sm text-[var(--text-dim)]">Alinhando o prumo...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'guest') {
    return (
      <LoginView
        onAuthSuccess={(u) => handleAuthSuccess(u, false)}
        onRegistered={(u) => handleAuthSuccess(u, true)}
        onGuestMode={() => {
          setAuthStatus('demo');
          setSyncStatus('local');
        }}
        isOnline={isOnline}
      />
    );
  }

  // Wizard de onboarding para contas reais recém-criadas (ou com pendência)
  if (authStatus === 'authed' && !isDemoMode && pendingOnboarding && !user.onboardingCompleted) {
    return (
      <OnboardingWizard
        name={user.name}
        country={country}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    );
  }

  // Paywall (Fase 5): contas reais sem acesso ativo veem o funil de vendas.
  // Demo continua aberto (vitrine); falha de rede = degrade aberto.
  if (
    authStatus === 'authed' &&
    !isDemoMode &&
    user.onboardingCompleted &&
    access !== null &&
    !access.hasAccess
  ) {
    return (
      <SalesFunnelView
        name={user.name}
        country={country}
        quiz={funnelQuiz}
        access={access}
        onUnlocked={() => {
          fetchAccess().then((a) => {
            if (a) setAccess(a);
          });
        }}
        onExit={handleLogout}
      />
    );
  }

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
        syncStatus={syncStatus}
      >
        <NotificationCenter
          notifications={notifications}
          onMarkAllRead={handleMarkAllNotificationsRead}
          onNavigate={handleNotificationNavigate}
        />
      </Header>

      {/* Main Tab Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        unreadAlertsCount={predictiveAlerts.length}
        showAdminTab={isAdmin}
      />

      {/* Main Content Area — cada aba entra com animação de reveal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'overview' && (
          <div className="reveal reveal-visible">
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
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="reveal reveal-visible">
            <TransactionsView
              transactions={transactions}
              accounts={accounts}
              country={country}
              onAddTransaction={handleAddTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              isOnline={isOnline}
              recurringRules={recurrenceRules}
              onOpenRecurrences={() => setIsRecurrenceOpen(true)}
              onOpenOfxImport={() => setIsOfxOpen(true)}
              onOpenReport={() => setIsReportOpen(true)}
            />
          </div>
        )}

        {activeTab === 'budgets' && (
          <div className="reveal reveal-visible">
            <BudgetsGoalsView
              user={user}
              budgetLimits={budgetLimits}
              transactions={transactions}
              country={country}
              goals={goals}
              categoryAllocations={categoryAllocations}
              onUpdateBudgetLimit={handleUpdateBudgetLimit}
              onAddBudgetLimit={handleAddBudgetLimit}
              onAddSavedAmountToPrimaryGoal={handleAddSavedAmountToPrimaryGoal}
              onAddGoal={handleAddGoal}
              onAllocateToCategory={handleAllocateToCategory}
              onClearCategoryAllocation={handleClearCategoryAllocation}
              onAutoAllocateAll={handleAutoAllocateAll}
            />
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="reveal reveal-visible">
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
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="reveal reveal-visible">
            <AccountsView
              user={user}
              country={country}
              accounts={accounts}
              onConnectAccount={handleConnectAccount}
              onSyncAccount={handleSyncAccount}
              onDeleteAccount={handleDeleteAccount}
              onToggle2FA={handleToggle2FA}
              onImportOpenFinance={handleImportOpenFinance}
            >
              <SharedSpaceCard
                user={user}
                country={country}
                isDemo={isDemoMode}
                onSpaceChanged={(name) => {
                  if (!name) return;
                  setNotifications((prev) => [
                    ...prev.filter((n) => !n.id.startsWith('ntf_shared_space_')),
                    {
                      id: `ntf_shared_space_${Date.now()}`,
                      userId: user.id,
                      kind: 'shared_space' as const,
                      title: `Você entrou no espaço "${name}"`,
                      message:
                        'Os membros aparecem na aba Contas, com resumo de saldo e gasto do mês.',
                      severity: 'info' as const,
                      triggeredAt: new Date().toISOString(),
                      readAt: null,
                      actionTab: 'accounts' as const,
                    },
                  ]);
                }}
              />
            </AccountsView>
          </div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <div className="reveal reveal-visible">
            <AdminView onToast={undefined} />
          </div>
        )}

        {activeTab === 'copilot' && (
          <div className="reveal reveal-visible">
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
          </div>
        )}
      </main>

      {/* Rodapé institucional: disclaimer financeiro + privacidade (LGPD) */}
      <footer
        id="prumo-footer"
        className="border-t border-[var(--line)] bg-[var(--surface)] mt-4"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-2.5 text-[11px] sm:text-xs text-[var(--text-dim)] leading-relaxed max-w-2xl">
            <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <p>
              O Prumo é uma ferramenta educacional de organização financeira. As análises,
              projeções e respostas do copiloto <strong className="text-[var(--text)]">não constituem aconselhamento
              financeiro, de investimento, jurídico ou tributário</strong>. Decisões com impacto
              patrimonial devem ser avaliadas com um profissional certificado. Simulações são
              estimativas baseadas nos dados que você fornece e não garantem resultados futuros.
            </p>
          </div>
          <div className="flex items-start gap-2.5 text-[11px] sm:text-xs text-[var(--text-dim)] leading-relaxed max-w-md">
            <Lock className="w-4 h-4 text-[var(--positive)] shrink-0 mt-0.5" />
            <p>
              <strong className="text-[var(--text)]">Seus dados são seus:</strong> lançamentos, contas e
              conversas ficam armazenados apenas no armazenamento local do seu dispositivo
              (conforme a LGPD n° 13.709/2018). Não enviamos seus dados financeiros a terceiros.
            </p>
          </div>
        </div>
        <div className="border-t border-[var(--line)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-[var(--text-dim)]">
            <span className="flex items-center gap-1.5">
              <span className="font-serif-display font-semibold text-[var(--text)]">Prumo</span>
              © {new Date().getFullYear()} — Copiloto financeiro para Brasil e Angola
            </span>
            <span>Beta público • v1.0</span>
          </div>
        </div>
      </footer>

      {/* ─── Modais da Fase 1 ─── */}
      <RecurrenceManagerModal
        open={isRecurrenceOpen}
        onClose={() => setIsRecurrenceOpen(false)}
        rules={recurrenceRules}
        accounts={accounts}
        country={country}
        onAddRule={handleAddRecurrenceRule}
        onToggleRule={handleToggleRecurrenceRule}
        onDeleteRule={handleDeleteRecurrenceRule}
      />
      <OfxImportModal
        open={isOfxOpen}
        onClose={() => setIsOfxOpen(false)}
        accounts={accounts}
        country={country}
        onImport={(txs) => {
          // Dedup contra o histórico: mesma data + valor + descrição já
          // registrada = importação repetida do mesmo extrato (ignora).
          const existingKeys = new Set(
            transactions.map((t) => `${t.occurredAt}|${t.amount}|${t.description.toLowerCase()}`)
          );
          const created = txs
            .filter((t) => !existingKeys.has(`${t.occurredAt}|${t.amount}|${t.description.toLowerCase()}`))
            .map((t, i) => ({
              ...t,
              id: `txo_${Date.now()}_${i}`,
              userId: user.id,
              createdAt: new Date().toISOString(),
            }));
          if (created.length > 0) {
            setTransactions((prev) => [...created, ...prev]);
          }
        }}
      />
      <MonthlyReportModal
        open={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        user={user}
        country={country}
        accounts={accounts}
        transactions={transactions}
        budgetLimits={budgetLimits}
      />

      {/* Profile / Calibration Modal (montado condicionalmente para re-inicializar os campos a cada abertura) */}
      {isProfileOpen && (
        <ProfileModal
          user={user}
          isOpen
          onClose={() => setIsProfileOpen(false)}
          onSaveProfile={handleSaveProfile}
          onToggle2FA={handleToggle2FA}
          accountEmail={authUser?.email}
          onLogout={handleLogout}
          onExportData={exportMyData}
          onDeleteAccount={deleteMyAccount}
        />
      )}
    </div>
  );
}
