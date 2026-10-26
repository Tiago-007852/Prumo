import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Compass,
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  Globe,
  WifiOff,
  ShieldCheck,
  Repeat,
  FileBarChart,
  Eye,
  EyeOff,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { PlumbLine } from './PlumbLine';

interface LoginViewProps {
  onAuthSuccess: (user: { id: string; email: string; name: string; country: 'BR' | 'AO' }) => void;
  /** Chamado quando a conta acabou de ser criada (dispara o onboarding). */
  onRegistered: (user: { id: string; email: string; name: string; country: 'BR' | 'AO' }) => void;
  onGuestMode: () => void;
  isOnline: boolean;
}

const FEATURES = [
  {
    icon: Sparkles,
    color: 'var(--accent)',
    title: 'Copiloto IA que fala a sua língua',
    text: 'Respostas com base no seu retrato financeiro real — e também por voz: pergunte falando.',
  },
  {
    icon: Repeat,
    color: 'var(--positive)',
    title: 'Recorrências e parcelas no automático',
    text: 'Aluguel, salário e assinaturas lançam sozinhos. Parcelas aparecem mês a mês.',
  },
  {
    icon: FileBarChart,
    color: 'var(--warn)',
    title: 'Extrato OFX e relatório em PDF',
    text: 'Importe o extrato do banco em segundos e gere um relatório mensal pronto para guardar.',
  },
  {
    icon: Globe,
    color: 'var(--accent-bright)',
    title: 'Brasil e Angola no mesmo app',
    text: 'R$ e Kz com dados isolados por país — e tudo funciona offline, sincroniza depois.',
  },
] as const;

const KPIS = [
  { value: '24', label: 'meses de projeção' },
  { value: '2', label: 'países, um app' },
  { value: '100%', label: 'offline-first' },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

export const LoginView: React.FC<LoginViewProps> = ({ onAuthSuccess, onRegistered, onGuestMode, isOnline }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState<'BR' | 'AO'>('BR');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGoogleAuth = async () => {
    setError(null);
    setBusy(true);
    try {
      const { signInWithGoogle } = await import('../services/googleAuthService');
      const user = await signInWithGoogle();
      onAuthSuccess({ id: user.id, email: user.email, name: user.name, country: user.country });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg === 'GOOGLE_SILENT_CANCEL' || msg.includes('closed') || msg.includes('dismissed')) {
        // Usuário fechou o popup — não é erro
        setError(null);
      } else {
        setError(msg || 'Não foi possível entrar com Google.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { register, login } = await import('../services/authService');
      if (mode === 'register') {
        const user = await register(email, password, name, country);
        onRegistered({ id: user.id, email: user.email, name: user.name, country: user.country });
      } else {
        const user = await login(email, password);
        onAuthSuccess({ id: user.id, email: user.email, name: user.name, country: user.country });
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      const networkError = msg.includes('fetch') || msg.includes('network') || msg.includes('NetworkError');
      setError(
        networkError
          ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente em instantes — seus dados locais continuam salvos.'
          : err?.message || 'Não foi possível continuar.'
      );
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-dim)]/70 outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]';

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row bg-[var(--bg)] text-[var(--text)] relative">
      {/* Fio dourado no topo da página (assinatura premium) */}
      <span
        aria-hidden="true"
        className="absolute top-0 inset-x-0 h-px z-20 opacity-80"
        style={{ background: 'linear-gradient(90deg, transparent 0%, var(--accent) 35%, var(--accent-bright) 55%, transparent 100%)' }}
      />

      {/* ── Coluna esquerda: identidade (~58%) ── */}
      <section className="relative lg:w-[58%] flex-1 flex flex-col p-8 sm:p-12 lg:p-16 overflow-hidden bg-[var(--surface-2)] border-b md:border-b-0 md:border-r border-[var(--line)]">
        {/* Fundo: auroras suaves (sem banding) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-70"
          style={{
            background:
              'radial-gradient(760px 420px at 16% -8%, var(--accent-soft) 0%, transparent 62%), radial-gradient(640px 420px at 96% 108%, var(--accent-soft) 0%, transparent 58%)',
          }}
        />

        {/* Prumo animado — ancorado no canto, sem invadir o texto */}
        <PlumbLine
          height={340}
          country={country}
          className="absolute -right-10 -bottom-8 w-[300px] opacity-50 hidden lg:block z-0"
        />

        {/* Cabeçalho: marca + pill de beta */}
        <motion.header
          className="relative z-10 flex items-center justify-between"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl bg-[var(--accent)] text-[color:var(--bg)] flex items-center justify-center"
              style={{ boxShadow: '0 0 24px var(--gold-glow)' }}
            >
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="font-serif-display font-semibold text-2xl tracking-tight leading-none">Prumo</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-1">Copiloto Financeiro · BR &amp; AO</div>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)]/60 px-3 py-1.5 text-[11px] font-medium text-[var(--text-dim)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)] animate-pulse" />
            beta público
          </span>
        </motion.header>

        {/* Herói */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-xl py-10">
          <motion.h1
            className="font-serif-display text-4xl sm:text-5xl xl:text-[3.4rem] font-bold leading-[1.06] tracking-tight text-balance"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
          >
            Seu dinheiro de volta ao{' '}
            <span className="text-[var(--accent)]">prumo</span>.
          </motion.h1>

          <motion.p
            className="mt-4 text-sm sm:text-base text-[var(--text-dim)] leading-relaxed max-w-md"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16, ease: EASE }}
          >
            Lançamentos, orçamentos, metas e copiloto IA — no Brasil e em Angola.
            <strong className="text-[var(--text)]"> 100% offline-first</strong>: funciona sem internet
            e sincroniza quando a conexão volta.
          </motion.p>

          {/* KPIs tipográficos (sem formatter de moeda — bug antigo) */}
          <motion.div
            className="mt-8 flex items-center gap-5 sm:gap-8"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: EASE }}
          >
            {KPIS.map((k, i) => (
              <React.Fragment key={k.label}>
                {i > 0 && <div className="w-px h-9 bg-[var(--line)]" />}
                <div>
                  <div
                    className="font-serif-display text-2xl sm:text-3xl font-bold text-[var(--accent)] leading-none"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {k.value}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-dim)] mt-1">
                    {k.label}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </motion.div>

          {/* Recursos — ocultos no mobile para o CTA ficar acima da dobra */}
          <motion.div
            className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.32, ease: EASE }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-[var(--line)] bg-[var(--surface)]/70 backdrop-blur-sm p-4 transition-colors duration-300 hover:border-[var(--accent)]/40"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: 'var(--accent-soft)' }}
                  >
                    <f.icon className="w-4 h-4" style={{ color: f.color }} />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight">{f.title}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">{f.text}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Rodapé de segurança */}
        <motion.p
          className="relative z-10 text-[11px] text-[var(--text-dim)] flex items-start gap-1.5 max-w-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--positive)] shrink-0 mt-0.5" />
          Ao continuar você concorda com o uso dos seus dados conforme a LGPD (n° 13.709/2018).
          Exporte ou elimine sua conta e dados a qualquer momento.
        </motion.p>
      </section>

      {/* ── Coluna direita: formulário (~42%) ── */}
      <section className="relative flex-1 flex items-center justify-center p-6 sm:p-12 md:h-screen">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
        >
          {!isOnline && (
            <div className="mb-5 p-3.5 rounded-xl border border-[var(--warn)]/30 bg-[var(--warn-soft)] text-xs text-[var(--text)] flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-[var(--warn)] shrink-0" />
              <span>Você está offline. Entrar exige conexão — seus dados locais continuam salvos no dispositivo.</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="relative rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-7 space-y-4"
            style={{ boxShadow: '0 24px 60px -24px var(--ink-glow)' }}
          >
            {/* Fio dourado no topo do card (eco da assinatura da página) */}
            <span
              aria-hidden="true"
              className="absolute -top-px left-10 right-10 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}
            />

            {/* Abas integradas ao card (antes flutuavam separadas — desalinhadas) */}
            <div className="grid grid-cols-2 p-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === m
                      ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                      : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  {m === 'login' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>

            <h2 className="font-serif-display text-2xl font-bold tracking-tight pt-1">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Comece agora'}
            </h2>

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label htmlFor="prumo-name" className="text-xs font-medium text-[var(--text-dim)]">Nome</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="prumo-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como devemos te chamar?"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="prumo-email" className="text-xs font-medium text-[var(--text-dim)]">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-3 pointer-events-none" />
                <input
                  id="prumo-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prumo-password" className="text-xs font-medium text-[var(--text-dim)]">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-3 pointer-events-none" />
                <input
                  id="prumo-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                  className={inputClass}
                  minLength={mode === 'register' ? 8 : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2.5 top-2 p-0.5 rounded-md text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label htmlFor="prumo-country" className="text-xs font-medium text-[var(--text-dim)]">País do mercado</label>
                <select
                  id="prumo-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value as 'BR' | 'AO')}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] cursor-pointer"
                >
                  <option value="BR">🇧🇷 Brasil (BRL / R$)</option>
                  <option value="AO">🇦🇴 Angola (AOA / Kz)</option>
                </select>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] text-xs font-medium text-[var(--danger)] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || (!isOnline && typeof navigator !== 'undefined' && !navigator.onLine)}
              className="cta-shine w-full py-3 rounded-xl bg-[var(--accent)] text-sm font-bold tracking-wide hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              style={{ boxShadow: '0 10px 30px -10px var(--gold-glow)' }}
            >
              {busy ? 'Aguarde...' : mode === 'login' ? 'Entrar no Prumo' : 'Criar minha conta'}
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--line)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-[var(--surface)] text-[11px] text-[var(--text-dim)]">ou</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full py-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continuar com Google</span>
            </button>
          </form>

          {/* Demo — botão fantasma abaixo do card, sem competir com o CTA */}
          <button
            type="button"
            onClick={onGuestMode}
            className="group mt-4 w-full py-2.5 rounded-xl border border-transparent text-sm font-semibold text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--line)] hover:bg-[var(--surface)]/50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            Explorar demonstração sem conta
            <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>

          <p className="mt-4 text-center text-[11px] text-[var(--text-dim)]">
            Prumo © {new Date().getFullYear()} · Sessão segura · LGPD
          </p>
        </motion.div>
      </section>
    </div>
  );
};
