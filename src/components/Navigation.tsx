import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  TrendingUp,
  Building2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export type TabKey = 'overview' | 'transactions' | 'budgets' | 'scenarios' | 'accounts' | 'copilot' | 'admin';

interface NavigationProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  unreadAlertsCount?: number;
  /** Mostrar a tab Admin (apenas admins — decidido no App via /me). */
  showAdminTab?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  unreadAlertsCount = 0,
  showAdminTab = false,
}) => {
  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { key: 'transactions', label: 'Lançamentos', icon: Receipt },
    { key: 'budgets', label: 'Orçamento & Metas', icon: PieChart },
    { key: 'scenarios', label: 'Simulação de Cenários', icon: TrendingUp },
    { key: 'accounts', label: 'Contas & Open Finance', icon: Building2 },
    { key: 'copilot', label: 'Copiloto IA', icon: Sparkles },
    ...(showAdminTab ? [{ key: 'admin' as TabKey, label: 'Admin', icon: ShieldCheck }] : []),
  ];

  return (
    <nav id="prumo-main-nav" className="border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                id={`nav-tab-${tab.key}`}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[var(--text-dim)]'}`} />
                <span>{tab.label}</span>
                {tab.key === 'copilot' && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 text-[10px] font-semibold rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    }`}
                  >
                    IA
                  </span>
                )}
                {tab.key === 'overview' && unreadAlertsCount > 0 && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 text-[10px] font-semibold rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[var(--warn-soft)] text-[var(--warn)]'
                    }`}
                  >
                    {unreadAlertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
