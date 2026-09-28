import React, { useEffect, useRef, useState } from 'react';
import { Notification } from '../types';
import {
  Bell,
  BellOff,
  CheckCheck,
  AlertTriangle,
  ShieldAlert,
  Info,
  Repeat,
  Target,
  Users,
} from 'lucide-react';

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAllRead: () => void;
  onNavigate: (tab: Notification['actionTab']) => void;
}

function iconFor(n: Notification) {
  switch (n.kind) {
    case 'budget_exceeded':
      return <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />;
    case 'budget_warning':
    case 'envelope_exhausted':
      return <AlertTriangle className="w-4 h-4 text-[var(--warn)]" />;
    case 'recurrence_upcoming':
      return <Repeat className="w-4 h-4 text-[var(--accent)]" />;
    case 'goal_progress':
    case 'goal_deadline':
      return <Target className="w-4 h-4 text-[var(--positive)]" />;
    case 'shared_space':
      return <Users className="w-4 h-4 text-[var(--accent)]" />;
    default:
      return <Info className="w-4 h-4 text-[var(--text-dim)]" />;
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAllRead,
  onNavigate,
}) => {
  const [open, setOpen] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.readAt).length;

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setJustOpened(true);
      // "justOpened" evita re-render imediato do badge antes do usuário ver o painel
      window.setTimeout(() => setJustOpened(false), 100);
    }
  };

  const handleItemClick = (n: Notification) => {
    if (n.actionTab) onNavigate(n.actionTab);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        id="btn-notifications"
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
        title={unread > 0 ? `${unread} notificação(ões) não lida(s)` : 'Notificações'}
        aria-label="Notificações"
      >
        {unread > 0 ? <Bell className="w-4 h-4 text-[var(--accent)]" /> : <BellOff className="w-4 h-4" />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--danger)] text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          className="absolute right-0 mt-2 w-[340px] sm:w-[380px] max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg z-50"
        >
          <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--line)] px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
              Notificações
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Marcar todas como lidas</span>
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <BellOff className="w-8 h-8 mx-auto text-[var(--text-dim)] opacity-50 mb-2" />
              <p className="text-xs text-[var(--text-dim)]">
                Tudo tranquilo por aqui. Você será avisado quando algo merecer atenção.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {notifications.map((n) => {
                const isUnread = !n.readAt && !justOpened;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left px-4 py-3 flex gap-3 transition-colors cursor-pointer hover:bg-[var(--surface-2)] ${
                      isUnread ? 'bg-[var(--accent-soft)]/40' : ''
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">{iconFor(n)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-xs font-semibold text-[var(--text)] leading-snug ${
                            isUnread ? '' : 'text-[var(--text-dim)]'
                          }`}
                        >
                          {n.title}
                        </span>
                        {isUnread && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-[var(--accent)] mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-dim)] leading-relaxed mt-0.5">
                        {n.message}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
