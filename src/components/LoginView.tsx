import React, { useState } from 'react';
import { Compass, Sparkles, Lock, Mail, User as UserIcon, Globe, WifiOff } from 'lucide-react';

interface LoginViewProps {
  onAuthSuccess: (user: { id: string; email: string; name: string; country: 'BR' | 'AO' }) => void;
  /** Chamado quando a conta acabou de ser criada (dispara o onboarding). */
  onRegistered: (user: { id: string; email: string; name: string; country: 'BR' | 'AO' }) => void;
  onGuestMode: () => void;
  isOnline: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onAuthSuccess, onRegistered, onGuestMode, isOnline }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState<'BR' | 'AO'>('BR');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGoogleAuth = () => {
    setError(
      'Login social chega em breve. Por enquanto, use email e senha — é igualmente seguro (senha protegida com bcrypt).'
    );
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
      const networkError =
        msg.includes('fetch') || msg.includes('network') || msg.includes('NetworkError');
      setError(
        networkError
          ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente em instantes — seus dados locais continuam salvos.'
          : err?.message || 'Não foi possível continuar.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--bg)] text-[var(--text)]">
      {/* Coluna esquerda — identidade do Prumo */}
      <div className="relative flex-1 flex flex-col justify-between p-8 sm:p-12 bg-[var(--surface-2)] border-b lg:border-b-0 lg:border-r border-[var(--line)] overflow-hidden">
        {/* Linha do prumo decorativa */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.35] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--line) 0 1px, transparent 1px 28px)',
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white shadow-sm">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="font-serif-display font-semibold text-3xl tracking-tight">Prumo</div>
            <div className="text-xs text-[var(--text-dim)]">Copiloto Financeiro · BR & AO</div>
          </div>
        </div>

        <div className="relative max-w-md space-y-5 py-10">
          <h1 className="font-serif-display text-3xl sm:text-4xl font-bold leading-tight">
            Seu dinheiro no prumo, de qualquer dispositivo.
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-dim)] leading-relaxed">
            Crie sua conta para que lançamentos, orçamentos, metas e conversas com o copiloto
            acompanhem você entre dispositivos — <strong className="text-[var(--text)]">sem
            perder o modo offline</strong>: tudo continua funcionando sem internet e sincroniza
            quando a conexão voltar.
          </p>

          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
              <span>Copiloto IA contextual com o seu retrato financeiro</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-[var(--positive)] mt-0.5 shrink-0" />
              <span>Senhas protegidas com bcrypt e sessão em cookie seguro</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-[var(--warn)] mt-0.5 shrink-0" />
              <span>Brasil (R$) e Angola (Kz) no mesmo app, com dados isolados</span>
            </li>
          </ul>
        </div>

        <p className="relative text-[11px] text-[var(--text-dim)]">
          Ao continuar você concorda com o uso dos seus dados conforme a LGPD (n° 13.709/2018). Você
          pode exportar ou eliminar sua conta e dados a qualquer momento nas configurações.
        </p>
      </div>

      {/* Coluna direita — formulário */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {!isOnline && (
            <div className="mb-5 p-3.5 rounded-xl border border-[var(--warn)]/30 bg-[var(--warn-soft)] text-xs text-[var(--text)] flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-[var(--warn)] shrink-0" />
              <span>
                Você está offline. Entrar exige conexão — seus dados locais continuam salvos no
                dispositivo.
              </span>
            </div>
          )}

          {/* Abas */}
          <div className="grid grid-cols-2 p-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-7 shadow-xs space-y-4">
            <h2 className="font-serif-display text-xl font-bold">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Comece agora'}
            </h2>

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-dim)]">Nome</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como devemos te chamar?"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-dim)]">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-dim)]">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  minLength={mode === 'register' ? 8 : undefined}
                  required
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-dim)]">País do mercado</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value as 'BR' | 'AO')}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="BR">🇧🇷 Brasil (BRL / R$)</option>
                  <option value="AO">🇦🇴 Angola (AOA / Kz)</option>
                </select>
              </div>
            )}

            {error && (
              <div role="alert" className="p-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] text-xs font-medium text-[var(--danger)] flex items-start gap-2">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || (!isOnline && typeof navigator !== 'undefined' && !navigator.onLine)}
              className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
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
              className="w-full py-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center justify-center gap-2"
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

          <button
            type="button"
            onClick={onGuestMode}
            className="mt-4 w-full text-center text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
          >
            Explorar demonstração sem conta →
          </button>

          <p className="mt-5 text-center text-[11px] text-[var(--text-dim)]">
            Prumo © {new Date().getFullYear()} · Dados protegidos por sessão segura · LGPD
          </p>
        </div>
      </div>
    </div>
  );
};
