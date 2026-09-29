import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Star,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  AlertCircle,
  KeyRound,
  Loader2,
  BadgeCheck,
  Zap,
} from 'lucide-react';
import { Country } from '../types';
import { PlanPricing, pricingFor } from '../config/pricing';
import { activateWithCode, startCheckout, AccessInfo } from '../services/accessService';

interface SalesFunnelViewProps {
  name: string;
  country: Country;
  /** Dados do quiz — personalização da oferta (renda, meta, contas). */
  quiz: {
    monthlyIncome?: number;
    primaryGoal?: string;
    goalTargetValue?: number;
    accountsCount: number;
  };
  access: AccessInfo | null;
  onUnlocked: () => void;
  /** Saída (logout) — o funil é fullscreen, sem header do app. */
  onExit?: () => void;
  /** Demo/dev: entra sem pagar (não exibido em produção). */
  onContinueDemo?: () => void;
}

const TOTAL_STEPS = 3;

/** Stack de produtos — espelha os módulos reais do app. */
const MODULES = [
  { tag: 'PAINEL', title: 'Painel Financeiro', pain: 'Você só percebe que exagerou quando a fatura fecha' },
  { tag: 'PLANILHA', title: 'Controle de Lançamentos', pain: 'As despesas que não aparecem todo mês são as que bagunçam tudo' },
  { tag: 'PLANILHA', title: 'Orçamentos & Metas', pain: 'Sem um passo a passo, você sabe o que fazer e mesmo assim nunca começa' },
  { tag: 'PLANILHA', title: 'Controle de Dívidas', pain: 'Sem estratégia, você paga a dívida errada primeiro — e ela nunca acaba' },
  { tag: 'COPILOTO', title: 'Copiloto IA 24h', pain: 'Conselho financeiro na hora, sem julgamento e sem marcação' },
  { tag: 'RELATÓRIOS', title: 'Relatórios & Exportação', pain: 'Sem relatório, todo mês começa do zero' },
];

const BONUSES = [
  { tag: 'BÔNUS 1', title: 'Checklist de Organização Financeira em 7 Dias', pain: 'O passo a passo para organizar tudo necessário em uma semana' },
  { tag: 'BÔNUS 2', title: 'Guia Rápido: Como Sair das Dívidas', pain: 'Estratégia simples para quitar dívidas mais rápido' },
];

/** Depoimentos (placeholders — substituir por reais antes de veicular anúncios). */
const TESTIMONIALS = [
  { name: 'Camila, 40', stars: 5, text: 'Meu problema era lembrar das despesas que não aparecem todo mês. Sempre chegava IPVA, IPTU ou alguma conta maior e bagunçava tudo. Com o Planejamento Anual, passei a me preparar antes e hoje consigo organizar o ano inteiro com muito mais tranquilidade.', tag: 'Planejamento Anual', highlighted: true },
  { name: 'Fernanda, 33', stars: 5, text: 'Eu tinha várias dívidas e acabava adiando porque nem sabia por onde começar. Com o Controle de Dívidas, organizei tudo, defini prioridades e finalmente comecei a sair do lugar. Já consegui quitar duas.', tag: 'Controle de Dívidas', highlighted: false },
  { name: 'Bruno, 30', stars: 5, text: 'Eu achava que gastava pouco em casa, mas nunca sobrava nada no fim do mês. Quando comecei a usar o Controle de Gastos Domésticos, enxerguei exatamente onde estava exagerando e consegui cortar vários gastos desnecessários.', tag: 'Gastos Domésticos', highlighted: false },
  { name: 'Lucas, 36', stars: 5, text: 'Antes eu só percebia que tinha exagerado quando a fatura fechava. Com o Controle de Cartão de Crédito, consigo acompanhar o quanto do limite já usei e pensar melhor antes de comprar. Hoje tenho muito mais controle.', tag: 'Cartão de Crédito', highlighted: false },
];

/** Formata o preço no padrão do país (Kz sem decimais, R$ com 2). */
function formatPrice(value: number, currency: 'BRL' | 'AOA'): string {
  if (currency === 'AOA') {
    return `${value.toLocaleString('pt-AO').replace(/[\u00A0\u202F]/g, '.')} Kz`;
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const SalesFunnelView: React.FC<SalesFunnelViewProps> = ({
  name,
  country,
  quiz,
  access,
  onUnlocked,
  onExit,
  onContinueDemo,
}) => {
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');

  const pricing: PlanPricing = useMemo(() => pricingFor(country), [country]);
  const isProd = import.meta.env.PROD;

  const goalLine = quiz.primaryGoal
    ? quiz.primaryGoal.charAt(0).toUpperCase() + quiz.primaryGoal.slice(1)
    : 'Organizar suas finanças';

  const handleActivateCode = async () => {
    if (!code.trim()) return;
    setPending(true);
    setError(null);
    const res = await activateWithCode(code.trim());
    setPending(false);
    if (res.ok) {
      onUnlocked();
    } else {
      setError(res.error || 'Código inválido');
    }
  };

  const handleCheckout = async () => {
    setPending(true);
    setError(null);
    // O servidor cria a Checkout Session com client_reference_id = userId —
    // a sessão paga só ativa ESTA conta (sem Payment Link estático).
    const res = await startCheckout();
    if (res.ok && res.url) {
      window.location.href = res.url;
      return;
    }
    setPending(false);
    if (res.configured === false) {
      setError('Checkout ainda não configurado — use a ativação por código abaixo.');
      setShowCodeInput(true);
    } else {
      setError(res.error || 'Falha ao iniciar o checkout');
    }
  };

  const stepBar = (
    <div className="w-full h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-bright)] transition-all duration-500"
        style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="w-9 h-9 rounded-full border border-[var(--line)] flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            onExit && (
              <button
                onClick={onExit}
                className="text-xs text-[var(--text-dim)] underline underline-offset-4 hover:text-[var(--text)] transition-colors px-1"
              >
                Sair
              </button>
            )
          )}
          <div className="flex-1 text-center">
            <div className="text-[10px] tracking-[0.35em] text-[var(--accent-bright)] font-semibold">PRUMO FINANCEIRO</div>
            <div className="font-serif-display font-semibold text-lg tracking-tight">PRUMO</div>
          </div>
          {step > 0 && <div className="w-9" />}
        </div>

        {stepBar}

        {/* ════════ PASSO 1 — Revelação personalizada ════════ */}
        {step === 0 && (
          <div className="flex flex-col gap-6 funnel-step">
            <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface)] p-6 sm:p-8 flex flex-col items-center gap-4 text-center relative overflow-hidden">
              <div
                className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-40 blur-3xl"
                style={{ background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)' }}
              />
              <div className="relative w-16 h-16 rounded-2xl bg-[var(--accent)] flex items-center justify-center" style={{ boxShadow: '0 0 40px var(--gold-glow)' }}>
                <TrendingUp className="w-8 h-8 text-white dark:text-[#0B0E14]" />
              </div>
              <h1 className="relative font-serif-display text-2xl sm:text-3xl font-bold leading-snug">
                {name || 'Pronto(a)'}: seu retrato financeiro está montado.
                <br />
                <span className="text-[var(--accent-bright)]">{goalLine}</span> começa agora.
              </h1>
              <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-3 w-full text-left">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Renda informada</div>
                  <div className="font-semibold text-sm mt-1">
                    {quiz.monthlyIncome ? formatPrice(quiz.monthlyIncome, pricing.currency) : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Meta</div>
                  <div className="font-semibold text-sm mt-1 truncate">{quiz.primaryGoal || 'Reserva inicial'}</div>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Contas conectadas</div>
                  <div className="font-semibold text-sm mt-1">{quiz.accountsCount}</div>
                </div>
              </div>
              <ul className="relative w-full text-left space-y-2.5">
                {[
                  'Registrando cada lançamento para saber exatamente para onde seu dinheiro vai',
                  'Criando o hábito diário que traz prosperidade',
                  'Eliminando dívidas e ansiedade com um plano claro',
                  'Assumindo o controle da sua vida financeira',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-[var(--positive)]/15 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-[var(--positive)]" />
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full py-4 rounded-xl bg-[var(--accent)] text-white dark:text-[#0B0E14] font-bold tracking-wide text-sm hover:brightness-110 transition-all"
              style={{ boxShadow: '0 8px 30px var(--gold-glow)' }}
            >
              CONTINUAR →
            </button>
          </div>
        )}

        {/* ════════ PASSO 2 — Prova social ════════ */}
        {step === 1 && (
          <div className="flex flex-col gap-5 funnel-step">
            <div className="text-center">
              <div className="text-[10px] tracking-[0.35em] text-[var(--accent-bright)] font-semibold mb-1">O QUE OS CLIENTES ESTÃO FALANDO</div>
              <h2 className="font-serif-display text-2xl font-bold">Quem já usou, já sentiu a diferença:</h2>
            </div>
            <div className="flex flex-col gap-3">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className={`rounded-2xl border p-4 sm:p-5 bg-[var(--surface)] ${
                    t.highlighted ? 'border-[var(--accent)]' : 'border-[var(--line)]'
                  }`}
                  style={t.highlighted ? { boxShadow: '0 0 24px var(--gold-glow)' } : undefined}
                >
                  {t.highlighted && (
                    <span className="inline-block -mt-7 mb-2 px-3 py-1 rounded-full bg-[var(--accent)] text-white dark:text-[#0B0E14] text-[10px] font-bold tracking-wide">
                      🖐 Passou pelo mesmo que você
                    </span>
                  )}
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-full bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center text-xs font-bold text-[var(--accent-bright)]">
                      {t.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-sm">{t.name}</span>
                    <span className="flex gap-0.5">
                      {Array.from({ length: t.stars }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                      ))}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-dim)] leading-relaxed">"{t.text}"</p>
                  <span className="inline-block mt-3 px-2.5 py-1 rounded-full bg-[var(--positive-soft)] text-[var(--positive)] text-[11px] font-semibold border border-[var(--positive)]/25">
                    {t.tag}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full py-4 rounded-xl bg-[var(--accent)] text-white dark:text-[#0B0E14] font-bold tracking-wide text-sm hover:brightness-110 transition-all"
              style={{ boxShadow: '0 8px 30px var(--gold-glow)' }}
            >
              CONTINUAR →
            </button>
          </div>
        )}

        {/* ════════ PASSO 3 — Oferta ════════ */}
        {step === 2 && (
          <div className="flex flex-col gap-5 funnel-step">
            {/* Stack de módulos */}
            <div className="flex flex-col gap-3">
              {MODULES.map((m) => (
                <div key={m.title} className="flex gap-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 items-center">
                  <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-bright)] flex items-center justify-center shrink-0" style={{ boxShadow: '0 0 16px var(--gold-glow)' }}>
                    <Zap className="w-5 h-5 text-white dark:text-[#0B0E14]" />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-full border border-[var(--accent)]/50 text-[var(--accent-bright)] text-[9px] font-bold tracking-widest">
                      {m.tag}
                    </span>
                    <div className="font-semibold text-sm mt-1">{m.title}</div>
                    <div className="text-xs text-[var(--text-dim)] leading-snug">{m.pain}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Card de preço */}
            <div className="relative rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 text-center" style={{ boxShadow: '0 0 40px var(--gold-glow)' }}>
              <span className="absolute -top-3.5 right-5 px-3 py-1.5 rounded-lg bg-[var(--positive)] text-white font-extrabold text-sm rotate-2">
                -{pricing.discountPct}% HOJE
              </span>
              <div className="text-[var(--text-dim)] text-sm line-through">{formatPrice(pricing.anchor, pricing.currency)}</div>
              <div className="font-serif-display font-extrabold text-5xl sm:text-6xl text-[var(--accent-bright)] mt-1 tracking-tight" style={{ textShadow: '0 0 24px var(--gold-glow)' }}>
                {formatPrice(pricing.monthly, pricing.currency)}
              </div>
              <div className="text-[var(--positive)] font-bold text-sm mt-2 tracking-wide uppercase">{pricing.perDayLabel}</div>
              <div className="text-[var(--text-dim)] text-xs mt-1">{pricing.billingNote}</div>
            </div>

            {/* CTA principal */}
            <button
              onClick={handleCheckout}
              disabled={pending}
              className="w-full py-4 rounded-xl bg-[var(--accent)] text-white dark:text-[#0B0E14] font-bold tracking-wide text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ boxShadow: '0 8px 30px var(--gold-glow)' }}
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              GARANTIR MEU ACESSO →
            </button>

            {/* Bônus */}
            <div className="rounded-2xl border border-dashed border-[var(--positive)]/40 p-4 flex flex-col gap-3">
              <div className="text-center text-[var(--positive)] font-bold text-sm">+ E ainda vai receber, sem custo extra:</div>
              {BONUSES.map((b) => (
                <div key={b.tag} className="flex gap-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 items-center">
                  <div className="w-10 h-10 rounded-lg bg-[var(--positive)]/15 border border-[var(--positive)]/30 flex items-center justify-center shrink-0">
                    <BadgeCheck className="w-5 h-5 text-[var(--positive)]" />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-full border border-[var(--positive)]/40 text-[var(--positive)] text-[9px] font-bold tracking-widest">
                      {b.tag}
                    </span>
                    <div className="font-semibold text-sm mt-1">{b.title}</div>
                    <div className="text-xs text-[var(--text-dim)] leading-snug">{b.pain}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Erro do checkout */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] p-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--danger)]" />
                <span>{error}</span>
              </div>
            )}

            {/* Ativação por código (vendas manuais / fallback) */}
            <div className="text-center">
              {showCodeInput ? (
                <div className="flex flex-col gap-2 items-center">
                  <div className="flex w-full max-w-sm gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="PRUMO-XXXX-XXXX-XXXX"
                      className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] uppercase"
                    />
                    <button
                      onClick={handleActivateCode}
                      disabled={pending || !code.trim()}
                      className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white dark:text-[#0B0E14] text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      Ativar
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)]">
                    Cada código funciona uma única vez e garante 31 dias de acesso.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setShowCodeInput(true)}
                  className="text-xs text-[var(--text-dim)] underline underline-offset-4 hover:text-[var(--text)] transition-colors"
                >
                  Já paguei ou tenho um código de ativação
                </button>
              )}
            </div>

            {/* Demo/dev: pular paywall — nunca em produção */}
            {onContinueDemo && !isProd && (
              <button
                onClick={onContinueDemo}
                className="text-xs text-[var(--text-dim)] underline underline-offset-4 hover:text-[var(--text)] transition-colors text-center"
              >
                Continuar em modo demonstração (dev)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
