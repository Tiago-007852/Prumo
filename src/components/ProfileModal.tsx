import React, { useState, useEffect } from 'react';
import { User, Country, UserProfile } from '../types';
import { User as UserIcon, Shield, Briefcase, Target, X, Check, Globe, LogOut, Download, Trash2 } from 'lucide-react';

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (updatedProfile: UserProfile, country: Country, name: string) => void;
  onToggle2FA: () => void;
  accountEmail?: string | null;
  onLogout?: () => void | Promise<void>;
  onExportData?: () => void | Promise<void>;
  onDeleteAccount?: (email: string) => void | Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onSaveProfile,
  onToggle2FA,
  accountEmail,
  onLogout,
  onExportData,
  onDeleteAccount,
}) => {
  // Hooks precisam rodar em toda renderização (Rules of Hooks) —
  // por isso o early return fica DEPOIS deles.
  const [name, setName] = useState(user.name);
  const [country, setCountry] = useState<Country>(user.country);
  const [profession, setProfession] = useState(user.profile.profession);
  const [primaryGoal, setPrimaryGoal] = useState(user.profile.primaryGoal);
  const [goalTargetValue, setGoalTargetValue] = useState(
    user.profile.goalTargetValue.toString()
  );
  const [goalDeadline, setGoalDeadline] = useState(user.profile.goalDeadline);
  const [monthlyIncomeExpectation, setMonthlyIncomeExpectation] = useState(
    user.profile.monthlyIncomeExpectation.toString()
  );
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [lgpdError, setLgpdError] = useState<string | null>(null);

  // Re-sincronizar os campos com o perfil sempre que o modal ABRIR.
  // Dependência apenas de isOpen: dependências no objeto user resetariam o
  // formulário em edição quando algo como o 2FA for alternado dentro do modal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setCountry(user.country);
      setProfession(user.profile.profession);
      setPrimaryGoal(user.profile.primaryGoal);
      setGoalTargetValue(user.profile.goalTargetValue.toString());
      setGoalDeadline(user.profile.goalDeadline);
      setMonthlyIncomeExpectation(user.profile.monthlyIncomeExpectation.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(
      {
        ...user.profile,
        profession,
        primaryGoal,
        goalTargetValue: parseFloat(goalTargetValue) || 10000,
        goalDeadline,
        monthlyIncomeExpectation: parseFloat(monthlyIncomeExpectation) || 5000,
      },
      country,
      name
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      ref={(node) => {
        if (node) node.focus();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-[var(--accent)]" />
            <h3
              id="profile-modal-title"
              className="font-serif-display font-bold text-lg text-[var(--text)]"
            >
              Perfil & Calibração do Copiloto
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Nome e País */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--text-dim)] font-medium">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                required
              />
            </div>
            <div>
              <label className="text-[var(--text-dim)] font-medium">País do Mercado</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as Country)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="BR">🇧🇷 Brasil (BRL / R$)</option>
                <option value="AO">🇦🇴 Angola (AOA / Kz)</option>
              </select>
            </div>
          </div>

          {/* Profissão */}
          <div>
            <label className="text-[var(--text-dim)] font-medium">
              Profissão / Modelo de Trabalho
            </label>
            <input
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="Ex: Designer Freelancer (PJ), Engenheiro de Software CLT, Médico"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              required
            />
            <span className="text-[11px] text-[var(--text-dim)] mt-0.5 block">
              O Prumo usa sua profissão para calcular meses de reserva de emergência recomendados (ex: 6 meses para PJ vs 3 meses para CLT estável).
            </span>
          </div>

          {/* Meta Principal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--text-dim)] font-medium">Meta Principal de Vida</label>
              <input
                type="text"
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                required
              />
            </div>
            <div>
              <label className="text-[var(--text-dim)] font-medium">
                Valor Alvo ({country === 'BR' ? 'R$' : 'Kz'})
              </label>
              <input
                type="number"
                value={goalTargetValue}
                onChange={(e) => setGoalTargetValue(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                required
              />
            </div>
          </div>

          {/* Prazo e Renda Esperada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--text-dim)] font-medium">Prazo Alvo da Meta</label>
              <input
                type="month"
                value={goalDeadline}
                onChange={(e) => setGoalDeadline(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-[var(--text-dim)] font-medium">
                Expectativa de Renda Mensal ({country === 'BR' ? 'R$' : 'Kz'})
              </label>
              <input
                type="number"
                value={monthlyIncomeExpectation}
                onChange={(e) => setMonthlyIncomeExpectation(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* 2FA Toggle */}
          <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between">
            <div>
              <div className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[var(--accent)]" />
                <span>Autenticação em Dois Fatores (2FA)</span>
              </div>
              <p className="text-[11px] text-[var(--text-dim)]">
                Exigido para autorizar conexões bancárias no Open Finance (Seção 2).
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle2FA}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                user.twoFactorEnabled ? 'bg-[var(--positive)]' : 'bg-[var(--line)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  user.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="pt-3 border-t border-[var(--line)] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text-dim)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold"
            >
              Salvar Alterações
            </button>
          </div>

          {/* Sessão & Privacidade (LGPD) */}
          <div className="pt-4 mt-2 border-t border-[var(--line)] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--text)]">Sessão</div>
                <div className="text-[11px] text-[var(--text-dim)] truncate">
                  {accountEmail || 'Modo convidado — dados apenas neste dispositivo'}
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              )}
            </div>

            {accountEmail && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-[11px] text-[var(--text-dim)]">
                  Direitos LGPD: portabilidade e eliminação dos seus dados.
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void Promise.resolve(onExportData?.())}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar</span>
                  </button>
                  {deleteConfirm ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await onDeleteAccount?.(accountEmail);
                            // conta eliminada: a sessão caiu, o app redireciona via estado de auth
                          } catch {
                            setLgpdError('Não foi possível eliminar a conta agora. Tente novamente.');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--danger)] text-white text-xs font-semibold cursor-pointer"
                      >
                        Confirmar eliminação
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(false)}
                        className="text-xs text-[var(--text-dim)] hover:underline cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--danger)]/40 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar conta</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {lgpdError && (
              <div role="alert" className="p-2.5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[11px] font-medium text-[var(--danger)]">
                {lgpdError}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
