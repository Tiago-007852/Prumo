import React, { useState } from 'react';
import { User, Country, UserProfile } from '../types';
import { User as UserIcon, Shield, Briefcase, Target, X, Check, Globe } from 'lucide-react';

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (updatedProfile: UserProfile, country: Country, name: string) => void;
  onToggle2FA: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onSaveProfile,
  onToggle2FA,
}) => {
  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="font-serif-display font-bold text-lg text-[var(--text)]">
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
        </form>
      </div>
    </div>
  );
};
