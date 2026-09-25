import React, { useMemo, useState } from 'react';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  Check,
  User as UserIcon,
  Briefcase,
  TrendingUp,
  Target,
  Wallet,
  SlidersHorizontal,
  Sparkles,
  Plus,
  Trash2,
  PiggyBank,
  GraduationCap,
  Zap,
  Landmark,
  CreditCard,
  Coins,
  Building,
} from 'lucide-react';
import { Country, GoalType, IncomeType, Account as AccountType, BudgetLimit } from '../types';
import { formatCurrency } from '../services/businessRules';

export interface OnboardingResult {
  profile: {
    profession: string;
    experienceLevel: 'iniciante' | 'intermediario' | 'avancado';
    monthlyIncomeExpectation: number;
    incomeType: IncomeType;
    primaryGoal: string;
    goalType: GoalType;
    goalTargetValue: number;
    goalSavedValue: number;
    goalDeadline: string;
  };
  accounts: Array<Omit<AccountType, 'id' | 'userId'> & { currency: 'BRL' | 'AOA' }>;
  budgetLimits: Array<{ category: string; monthlyLimit: number }>;
}

interface OnboardingWizardProps {
  name: string;
  country: Country;
  onComplete: (result: OnboardingResult) => void;
  onSkip: () => void;
}

const TOTAL_STEPS = 6;

const GOAL_TYPES: Array<{ type: GoalType; label: string; icon: React.ReactNode; description: string }> = [
  { type: 'reserva', label: 'Reserva de emergência', icon: <PiggyBank className="w-4 h-4" />, description: 'Cobertura para imprevistos' },
  { type: 'quitar_divida', label: 'Quitar dívidas', icon: <Coins className="w-4 h-4" />, description: 'Cartão, empréstimos, financiamentos' },
  { type: 'casa', label: 'Casa própria', icon: <Landmark className="w-4 h-4" />, description: 'Entrada ou quitação do imóvel' },
  { type: 'carro', label: 'Veículo', icon: <Building className="w-4 h-4" />, description: 'Compra à vista ou entrada' },
  { type: 'educacao', label: 'Educação', icon: <GraduationCap className="w-4 h-4" />, description: 'Curso, faculdade, certificação' },
  { type: 'negocio', label: 'Investir no negócio', icon: <Zap className="w-4 h-4" />, description: 'Equipamentos, capital de giro' },
  { type: 'outra', label: 'Outra meta', icon: <Target className="w-4 h-4" />, description: 'Descreva com suas palavras' },
  { type: 'nenhuma', label: 'Ainda não tenho meta', icon: <Sparkles className="w-4 h-4" />, description: 'O Prumo sugere uma reserva inicial' },
];

const BUDGET_CATEGORIES = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer & Cultura',
  'Serviços & Assinaturas',
];

/** Sugestões de orçamento como % da renda mensal informada. */
const BUDGET_SUGGESTIONS: Record<string, number> = {
  Moradia: 0.3,
  Alimentação: 0.15,
  Transporte: 0.08,
  Saúde: 0.06,
  Educação: 0.05,
  'Lazer & Cultura': 0.05,
  'Serviços & Assinaturas': 0.03,
};

const emptyAccountDraft = (): { institutionName: string; kind: AccountType['kind']; balance: string } => ({
  institutionName: '',
  kind: 'checking',
  balance: '',
});

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ name, country, onComplete, onSkip }) => {
  const [step, setStep] = useState(0);

  // Passo 2 — Perfil
  const [profession, setProfession] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'iniciante' | 'intermediario' | 'avancado'>('iniciante');

  // Passo 3 — Renda
  const [income, setIncome] = useState('');
  const [incomeType, setIncomeType] = useState<IncomeType>('fixa');

  // Passo 4 — Meta
  const [goalType, setGoalType] = useState<GoalType>('reserva');
  const [goalLabel, setGoalLabel] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalSaved, setGoalSaved] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');

  // Passo 5 — Contas
  const [accountDrafts, setAccountDrafts] = useState<Array<{ institutionName: string; kind: AccountType['kind']; balance: string }>>([emptyAccountDraft()]);

  // Passo 6 — Orçamento
  const [budgetValues, setBudgetValues] = useState<Record<string, string>>({});
  const [budgetEnabled, setBudgetEnabled] = useState<Record<string, boolean>>({});

  const incomeNum = Number(income) || 0;
  const currency: 'BRL' | 'AOA' = country === 'BR' ? 'BRL' : 'AOA';

  const suggestedBudgets = useMemo(() => {
    const out: Record<string, number> = {};
    if (incomeNum > 0) {
      for (const cat of BUDGET_CATEGORIES) {
        out[cat] = Math.round(incomeNum * BUDGET_SUGGESTIONS[cat]);
      }
    }
    return out;
  }, [incomeNum]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return profession.trim().length > 0;
      case 2:
        return incomeNum >= 0 && income.trim().length > 0;
      case 3:
        if (goalType === 'nenhuma') return true;
        return goalType === 'outra' ? goalLabel.trim().length > 0 : Number(goalTarget) >= 0 && goalTarget.trim().length > 0;
      case 4:
        return true; // contas são opcionais
      case 5:
        return true; // orçamento é opcional
      default:
        return true;
    }
  }, [step, profession, income, incomeNum, goalType, goalLabel, goalTarget]);

  const next = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    // Perfil
    const saved = Number(goalSaved) || 0;
    const target = Number(goalTarget) || 0;
    const profile: OnboardingResult['profile'] = {
      profession: profession.trim(),
      experienceLevel,
      monthlyIncomeExpectation: incomeNum,
      incomeType,
      primaryGoal:
        goalType === 'nenhuma'
          ? 'Reserva de emergência inicial'
          : goalType === 'outra'
          ? goalLabel.trim()
          : GOAL_TYPES.find((g) => g.type === goalType)?.label || goalLabel.trim(),
      goalType,
      goalTargetValue: goalType === 'nenhuma' ? 0 : target,
      goalSavedValue: saved,
      goalDeadline,
    };

    // Contas informadas (pula rascunhos vazios)
    const accounts = accountDrafts
      .filter((d) => d.institutionName.trim().length > 0)
      .map((d) => ({
        provider: 'manual' as const,
        institutionName: d.institutionName.trim(),
        kind: d.kind,
        balance: Number(d.balance) || 0,
        currency,
        lastSyncedAt: new Date().toISOString(),
        status: 'manual' as const,
      }));

    // Orçamentos marcados com valores
    const budgetLimits = BUDGET_CATEGORIES.filter((cat) => budgetEnabled[cat])
      .map((cat) => ({ category: cat, monthlyLimit: Number(budgetValues[cat]) || suggestedBudgets[cat] || 0 }))
      .filter((b) => b.monthlyLimit > 0);

    onComplete({ profile, accounts, budgetLimits });
  };

  const updateDraft = (idx: number, patch: Partial<{ institutionName: string; kind: AccountType['kind']; balance: string }>) => {
    setAccountDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const inputCls =
    'w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]';
  const cardCls =
    'w-full text-left p-3.5 rounded-xl border cursor-pointer transition-all';

  const steps = [
    { icon: <Compass className="w-4 h-4" />, label: 'Boas-vindas' },
    { icon: <UserIcon className="w-4 h-4" />, label: 'Perfil' },
    { icon: <TrendingUp className="w-4 h-4" />, label: 'Renda' },
    { icon: <Target className="w-4 h-4" />, label: 'Meta' },
    { icon: <Wallet className="w-4 h-4" />, label: 'Contas' },
    { icon: <SlidersHorizontal className="w-4 h-4" />, label: 'Orçamento' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)] p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white shadow-sm">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="font-serif-display font-semibold text-2xl tracking-tight">Prumo</div>
            <div className="text-xs text-[var(--text-dim)]">Configuração inicial · {name || 'Novo usuário'}</div>
          </div>
        </div>

        {/* Indicador de passos */}
        <div className="flex items-center gap-1.5 mb-6">
          {steps.map((s, i) => (
            <div key={s.label} className="flex-1 flex flex-col gap-1.5">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  i < step ? 'bg-[var(--positive)]' : i === step ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
                }`}
              />
              <span
                className={`text-[10px] font-semibold flex items-center gap-1 ${
                  i <= step ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
                }`}
              >
                {i < step ? <Check className="w-3 h-3 text-[var(--positive)]" /> : s.icon}
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Card do passo atual */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs">
          {/* ─── Passo 0: Boas-vindas ─── */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-serif-display text-2xl font-bold">Bem-vindo(a) ao Prumo, {name || 'tudo bem'}!</h2>
              <p className="text-sm text-[var(--text-dim)] leading-relaxed">
                Nos próximos passos vamos montar seu retrato financeiro. Com ele, o copiloto entende
                sua realidade e o painel mostra <strong className="text-[var(--text)]">apenas os seus dados</strong> —
                nada de exemplos fictícios.
              </p>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                  <span>Leva cerca de <strong className="text-[var(--text)]">2 minutos</strong>. Cada pergunta pode ser pulada.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                  <span>Tudo funciona <strong className="text-[var(--text)]">offline</strong> e sincroniza depois, se estiver com conta.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[var(--positive)] mt-0.5 shrink-0" />
                  <span>Você pode corrigir tudo depois no perfil e nas telas de orçamentos e contas.</span>
                </li>
              </ul>
            </div>
          )}

          {/* ─── Passo 1: Perfil ─── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif-display text-xl font-bold">Sobre você</h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  Isso personaliza o tom do copiloto e a forma como os alertas são calculados.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-dim)]">Profissão ou área de atuação</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-3" />
                  <input
                    type="text"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="Ex.: Designer autônomo, professor, engenheiro CLT..."
                    className={`${inputCls} pl-9`}
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-dim)]">Como você se considera em finanças?</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { v: 'iniciante', l: 'Começando agora' },
                    { v: 'intermediario', l: 'Já me organizo' },
                    { v: 'avancado', l: 'Avançado' },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setExperienceLevel(o.v)}
                      className={`${cardCls} text-center text-sm font-semibold ${
                        experienceLevel === o.v
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Passo 2: Renda ─── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif-display text-xl font-bold">Sua renda mensal</h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  Uma estimativa basta — servirá de base para o simulador e os orçamentos.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-dim)]">
                  Renda esperada por mês ({country === 'BR' ? 'R$' : 'Kz'})
                </label>
                <input
                  type="number"
                  min={0}
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder={country === 'BR' ? 'Ex.: 5000' : 'Ex.: 800000'}
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-dim)]">Sua renda é…</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { v: 'fixa', l: 'Fixa', d: 'Salário CLT, aposentadoria' },
                    { v: 'variavel', l: 'Variável', d: 'Freelance, comissões, vendas' },
                    { v: 'mista', l: 'Mista', d: 'Salário + extras' },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setIncomeType(o.v)}
                      className={`${cardCls} ${
                        incomeType === o.v
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                          : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]/40'
                      }`}
                    >
                      <span className="text-sm font-semibold text-[var(--text)]">{o.l}</span>
                      <span className="block text-[11px] text-[var(--text-dim)] mt-0.5">{o.d}</span>
                    </button>
                  ))}
                </div>
                {incomeType !== 'fixa' && (
                  <p className="text-[11px] text-[var(--warn)] mt-2">
                    Com renda {incomeType}, o Prumo recomenda reserva de emergência maior (6–12 meses de despesas).
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ─── Passo 3: Meta ─── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif-display text-xl font-bold">Qual seu objetivo principal?</h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  O copiloto usará essa meta para orientar sugestões e o painel mostrará o progresso.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GOAL_TYPES.map((g) => (
                  <button
                    key={g.type}
                    type="button"
                    onClick={() => setGoalType(g.type)}
                    className={`${cardCls} flex items-start gap-2.5 ${
                      goalType === g.type
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]/40'
                    }`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 ${
                        goalType === g.type ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
                      }`}
                    >
                      {g.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--text)]">{g.label}</span>
                      <span className="block text-[11px] text-[var(--text-dim)]">{g.description}</span>
                    </span>
                  </button>
                ))}
              </div>

              {goalType === 'outra' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-dim)]">Descreva sua meta</label>
                  <input
                    type="text"
                    value={goalLabel}
                    onChange={(e) => setGoalLabel(e.target.value)}
                    placeholder="Ex.: Intercâmbio em 2027"
                    className={inputCls}
                  />
                </div>
              )}

              {goalType !== 'nenhuma' && goalType !== 'outra' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-dim)]">Valor alvo</label>
                    <input
                      type="number"
                      min={0}
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                      placeholder={country === 'BR' ? 'Ex.: 24000' : 'Ex.: 3000000'}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-dim)]">Já tenho guardado</label>
                    <input
                      type="number"
                      min={0}
                      value={goalSaved}
                      onChange={(e) => setGoalSaved(e.target.value)}
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-dim)]">Prazo (mês/ano)</label>
                    <input
                      type="month"
                      value={goalDeadline}
                      onChange={(e) => setGoalDeadline(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {goalType === 'nenhuma' && (
                <p className="text-xs text-[var(--text-dim)] bg-[var(--surface-2)] border border-[var(--line)] rounded-lg p-3">
                  Sem problemas. O Prumo acompanha suas despesas e vai sugerir uma
                  <strong className="text-[var(--text)]"> reserva de emergência</strong> adequada ao seu perfil.
                </p>
              )}
            </div>
          )}

          {/* ─── Passo 4: Contas ─── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif-display text-xl font-bold">Suas contas</h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  Cadastre o saldo atual de onde seu dinheiro fica. É opcional — pode adicionar depois.
                </p>
              </div>

              <div className="space-y-3">
                {accountDrafts.map((draft, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-1 space-y-1">
                        <label className="text-[11px] font-medium text-[var(--text-dim)]">Instituição</label>
                        <input
                          type="text"
                          value={draft.institutionName}
                          onChange={(e) => updateDraft(idx, { institutionName: e.target.value })}
                          placeholder={country === 'BR' ? 'Nubank, Itaú…' : 'BAI, BFA…'}
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-[var(--text-dim)]">Tipo</label>
                        <select
                          value={draft.kind}
                          onChange={(e) => updateDraft(idx, { kind: e.target.value as AccountType['kind'] })}
                          className={inputCls}
                        >
                          <option value="checking">Conta corrente</option>
                          <option value="savings">Poupança</option>
                          <option value="investment">Investimento</option>
                          <option value="credit">Cartão de crédito</option>
                          <option value="digital_wallet">Carteira digital</option>
                          <option value="cash">Dinheiro em casa</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-[var(--text-dim)]">
                          Saldo atual ({country === 'BR' ? 'R$' : 'Kz'})
                        </label>
                        <input
                          type="number"
                          value={draft.balance}
                          onChange={(e) => updateDraft(idx, { balance: e.target.value })}
                          placeholder="0"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    {accountDrafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAccountDrafts((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-[11px] font-semibold text-[var(--danger)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setAccountDrafts((prev) => [...prev, emptyAccountDraft()])}
                className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar outra conta
              </button>

              <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
                <CreditCard className="w-3.5 h-3.5" />
                <span>A conexão automática (Open Finance) virá em atualização futura — por enquanto o saldo é manual.</span>
              </div>
            </div>
          )}

          {/* ─── Passo 5: Orçamento ─── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif-display text-xl font-bold">Limites por categoria</h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  {incomeNum > 0
                    ? `Sugestões proporcionais à sua renda de ${formatCurrency(incomeNum, country)}. Ajuste como quiser.`
                    : 'Marque as categorias que quer controlar e defina um limite mensal.'}
                </p>
              </div>

              <div className="space-y-2">
                {BUDGET_CATEGORIES.map((cat) => {
                  const suggested = suggestedBudgets[cat] || 0;
                  const enabled = !!budgetEnabled[cat];
                  return (
                    <div
                      key={cat}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        enabled ? 'border-[var(--accent)]/40 bg-[var(--accent-soft)]/40' : 'border-[var(--line)] bg-[var(--surface-2)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setBudgetEnabled((prev) => ({ ...prev, [cat]: e.target.checked }))}
                        className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                      />
                      <span className="text-sm font-medium text-[var(--text)] flex-1">{cat}</span>
                      {suggested > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetEnabled((prev) => ({ ...prev, [cat]: true }));
                            setBudgetValues((prev) => ({ ...prev, [cat]: String(suggested) }));
                          }}
                          className="text-[11px] font-semibold text-[var(--accent)] hover:underline whitespace-nowrap cursor-pointer"
                        >
                          usar {formatCurrency(suggested, country)}
                        </button>
                      )}
                      <input
                        type="number"
                        min={0}
                        value={budgetValues[cat] ?? ''}
                        onChange={(e) => {
                          setBudgetValues((prev) => ({ ...prev, [cat]: e.target.value }));
                          if (e.target.value) setBudgetEnabled((prev) => ({ ...prev, [cat]: true }));
                        }}
                        placeholder="0"
                        className="w-28 px-2.5 py-1.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-[var(--text-dim)]">
                Pode pular e definir depois na aba <strong className="text-[var(--text)]">Orçamentos & Metas</strong>.
              </p>
            </div>
          )}

          {/* Navegação */}
          <div className="mt-7 flex items-center justify-between gap-3">
            <div>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:underline cursor-pointer"
              >
                Pular configuração
              </button>
              <button
                type="button"
                disabled={!canAdvance}
                onClick={next}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                {step === TOTAL_STEPS - 1 ? (
                  <>
                    <Check className="w-4 h-4" /> Ir para o painel
                  </>
                ) : (
                  <>
                    Continuar <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-[var(--text-dim)]">
          Seus dados ficam no seu dispositivo e, com conta, sincronizam criptografados via sessão segura (LGPD).
        </p>
      </div>
    </div>
  );
};
