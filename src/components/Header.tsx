import React from 'react';
import { Country, User } from '../types';
import { ShieldCheck, Moon, Sun, User as UserIcon, RefreshCw, Compass, WifiOff, HardDrive, Cloud, CloudOff, Loader2 } from 'lucide-react';
import type { SyncStatus } from '../services/syncService';

interface HeaderProps {
  user: User;
  currentCountry: Country;
  onCountryChange: (country: Country) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onResetData: () => void;
  isOnline?: boolean;
  syncStatus?: SyncStatus;
  /** Elementos extras (ex.: centro de notificações) renderizados antes dos controles. */
  children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  currentCountry,
  onCountryChange,
  isDarkMode,
  onToggleTheme,
  onOpenProfile,
  onResetData,
  isOnline = true,
  syncStatus = 'local',
  children,
}) => {
  return (
    <header
      id="prumo-header"
      className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-md transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white shadow-sm">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif-display font-semibold text-2xl tracking-tight text-[var(--text)]">
                Prumo
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-xs rounded font-medium bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20">
                Copiloto Financeiro
              </span>
            </div>
            <p className="hidden md:block text-xs text-[var(--text-dim)] truncate max-w-sm">
              Adapta-se à sua profissão e às suas metas
            </p>
          </div>
        </div>

        {/* Right controls: Notifications, Country, 2FA, Theme, User */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Centro de notificações (Fase 3) */}
          {children}

          {/* Seletor de País (Brasil / Angola) */}
          <div
            id="country-selector-group"
            className="flex items-center p-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs font-medium"
          >
            <button
              id="country-btn-br"
              type="button"
              onClick={() => onCountryChange('BR')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
                currentCountry === 'BR'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
              title="Brasil (BRL / R$)"
            >
              <span className="text-sm">🇧🇷</span>
              <span>BR (R$)</span>
            </button>
            <button
              id="country-btn-ao"
              type="button"
              onClick={() => onCountryChange('AO')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
                currentCountry === 'AO'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
              title="Angola (AOA / Kz)"
            >
              <span className="text-sm">🇦🇴</span>
              <span>AO (Kz)</span>
            </button>
          </div>

          {/* Status Offline / Storage Local */}
          {!isOnline ? (
            <div
              id="badge-offline-status"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-[var(--warn)] bg-[var(--warn-soft)] border border-[var(--warn)]/30 animate-pulse"
              title="Modo Offline ativo: todos os lançamentos e dados são salvos localmente no dispositivo"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline (Salvo Local)</span>
            </div>
          ) : (
            <div
              id="badge-storage-status"
              className="hidden xl:flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-dim)]"
              title={
                syncStatus === 'synced'
                  ? 'Dados salvos localmente e sincronizados com sua conta'
                  : syncStatus === 'pending'
                  ? 'Alterações locais prontas para sincronizar com sua conta'
                  : syncStatus === 'error'
                  ? 'Não foi possível sincronizar agora — seus dados continuam salvos no dispositivo'
                  : 'Persistência local ativa via LocalStorage'
              }
            >
              {syncStatus === 'synced' ? (
                <>
                  <Cloud className="w-3 h-3 text-[var(--positive)]" />
                  <span>Sincronizado</span>
                </>
              ) : syncStatus === 'pending' ? (
                <>
                  <Loader2 className="w-3 h-3 text-[var(--warn)] animate-spin" />
                  <span>Sincronizando…</span>
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <CloudOff className="w-3 h-3 text-[var(--danger)]" />
                  <span>Sync pendente</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3 h-3 text-[var(--positive)]" />
                  <span>Salvo Localmente</span>
                </>
              )}
            </div>
          )}

          {/* 2FA Badge */}
          <div
            id="badge-2fa-status"
            className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--positive)] bg-[var(--positive-soft)] border border-[var(--positive)]/20"
            title="Autenticação em 2 Fatores ativa para conexões bancárias"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2FA Ativo</span>
          </div>

          {/* Theme Toggle */}
          <button
            id="btn-toggle-theme"
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            title={isDarkMode ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
            aria-label="Alternar tema"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-[var(--warn)]" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Reset Demo Data */}
          <button
            id="btn-reset-data"
            type="button"
            onClick={onResetData}
            className="hidden sm:flex p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            title="Restaurar dados padrão do país"
            aria-label="Restaurar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Profile pill */}
          <button
            id="btn-user-profile"
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-all text-left"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center font-medium text-xs">
              {user.name.charAt(0)}
            </div>
            <div className="hidden sm:block text-xs">
              <div className="font-semibold text-[var(--text)] truncate max-w-[130px]">{user.name}</div>
              <div className="text-[var(--text-dim)] text-[11px] truncate max-w-[130px]">
                {user.profile.profession}
              </div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
