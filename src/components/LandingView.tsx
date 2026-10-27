import React, { useEffect, useState } from 'react';
import '../styles/prumo-landing.css';
import {
  LANDING_COMPANIES,
  LANDING_DEFAULT_COUNTRY,
  LANDING_PREVIEW,
  LANDING_PREVIEW_ORDER,
  LANDING_SOCIAL_LOGOS,
  LANDING_TOTAL_COMPANIES,
  type LandingCountry,
  type LandingLogoMark,
} from '../config/landing';

/**
 * Landing "liquid glass" (fonte da verdade: docs/reference-landing/Prumo.jsx + Prumo.css).
 *
 * A estrutura, os textos e os dados são os da referência. O que veio do login
 * anterior é apenas a ligação à lógica já existente: cadastro, login, Google,
 * modo demo, estados de carregamento/erro e a validação dos campos.
 */
interface LandingViewProps {
  onAuthSuccess: (user: { id: string; email: string; name: string; country: 'BR' | 'AO' }) => void;
  /** Chamado quando a conta acabou de ser criada (dispara o onboarding). */
  onRegistered: (user: { id: string; email: string; name: string; country: 'BR' | 'AO' }) => void;
  onGuestMode: () => void;
  isOnline: boolean;
}

const Ico = ({ d, s = 18, fill = 'none' }: { d: string; s?: number; fill?: string }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const P = {
  mail: 'M3 5h18v14H3z M3 7l9 6 9-6',
  user: 'M12 4a4 4 0 100 8 4 4 0 000-8z M4 21a8 8 0 0116 0',
  lock: 'M4 11h16v10H4z M8 11V7a4 4 0 018 0v4',
  spark:
    'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z M19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  repeat: 'M17 2l4 4-4 4 M3 11V9a3 3 0 013-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 01-3 3H3',
  file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z M14 3v5h5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  play: 'M7 4.5v15l13-7.5z',
  alert: 'M12 8v5 M12 17h.01 M10.3 3.9L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
} as const;

/**
 * Marca do Prumo: o fio, o anel e a massa do prumo (o instrumento que dá o nome
 * ao app). Substitui o ícone genérico do cabeçalho da referência — a mesma arte
 * do favicon/ap icon (`public/favicon.svg`), desenhada no mesmo viewBox 0 0 64 64
 * para que cabeçalho e separador do navegador mostrem exatamente o mesmo logo.
 */
const PRUMO_MARK = {
  wire: 'M32 7.5V16.5',
  mass: 'M32 25.6C40.5 25.6 45 31.4 45 37.8C45 45.6 38.8 52.4 32 57.6C25.2 52.4 19 45.6 19 37.8C19 31.4 23.5 25.6 32 25.6Z',
};

const PrumoMark = ({ s = 27 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d={PRUMO_MARK.wire} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="32" cy="21" r="4.6" stroke="currentColor" strokeWidth="2.6" />
    <path d={PRUMO_MARK.mass} fill="currentColor" />
  </svg>
);

/**
 * Marcas abstratas dos avatares de prova social (LANDING_SOCIAL_LOGOS).
 * Desenhadas no viewBox 0 0 24 24 e herdadas via currentColor.
 */
const LOGO_MARKS: Record<LandingLogoMark, string> = {
  diamond: 'M12 3.4 20.6 12 12 20.6 3.4 12z',
  hexagon: 'M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6z',
  triangle: 'M12 3.5 20.7 18.9H3.3z',
  ring: 'M12 4.1a7.9 7.9 0 100 15.8 7.9 7.9 0 000-15.8zm0 4.3a3.6 3.6 0 110 7.2 3.6 3.6 0 010-7.2z',
};

const LogoMark = ({ mark }: { mark: LandingLogoMark }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path d={LOGO_MARKS[mark]} fill="currentColor" fillRule="evenodd" />
  </svg>
);

/** Contagem animada do painel de prova social (1200 ms, ease-out cúbico). */
function useCount(to: number, ms = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(to);
      return;
    }
    let raf = 0;
    let t0: number | null = null;
    const step = (t: number) => {
      if (t0 === null) t0 = t;
      const p = Math.min((t - t0) / ms, 1);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

const Google = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"
    />
    <path
      fill="#FBBC05"
      d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
    />
  </svg>
);

export const LandingView: React.FC<LandingViewProps> = ({
  onAuthSuccess,
  onRegistered,
  onGuestMode,
  isOnline,
}) => {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [country, setCountry] = useState<LandingCountry>(LANDING_DEFAULT_COUNTRY);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const d = LANDING_PREVIEW[country];
  const nTotal = useCount(LANDING_TOTAL_COMPANIES);
  const nAO = useCount(LANDING_COMPANIES.AO);
  const nBR = useCount(LANDING_COMPANIES.BR);

  const T =
    mode === 'signup'
      ? ['Comece em 1 minuto', 'Grátis durante o beta. Sem cartão.', 'Criar conta grátis']
      : ['Bem-vindo de volta', 'Entre para ver o seu panorama de hoje.', 'Entrar no Prumo'];

  const offline = !isOnline && typeof navigator !== 'undefined' && !navigator.onLine;

  const switchMode = (next: 'signup' | 'login') => {
    setMode(next);
    setError(null);
  };

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
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { register, login } = await import('../services/authService');
      if (mode === 'signup') {
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

  return (
    <div className="prumo-landing">
      <div className="bg" aria-hidden="true">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="grid" />
      </div>

      <main className="wrap">
        <section>
          <div className="top">
            <div className="brand">
              <div className="logo">
                <PrumoMark />
              </div>
              <div>
                <b>Prumo</b>
                <small>Copiloto financeiro para Brasil e Angola</small>
              </div>
            </div>
            <div className="glass pill" style={{ borderRadius: 99 }}>
              <i />
              beta público
            </div>
          </div>

          <h1>
            Seu dinheiro de volta ao <em>prumo</em>.
          </h1>
          <p className="lead">
            Lançamentos, orçamentos, metas e um copiloto de IA que conhece as suas contas.{' '}
            <b>Funciona sem internet</b> e sincroniza quando a conexão volta.
          </p>

          <div className="glass proof">
            <div className="avs" aria-hidden="true">
              {LANDING_SOCIAL_LOGOS.map((logo) => (
                <i
                  key={logo.mark}
                  style={
                    logo.src
                      ? { backgroundImage: `url(${logo.src})`, backgroundSize: 'cover' }
                      : undefined
                  }
                >
                  {!logo.src && <LogoMark mark={logo.mark} />}
                </i>
              ))}
            </div>
            <div className="ptxt">
              <strong>{nTotal} empresas</strong>
              <span>já usam o Prumo no dia a dia</span>
            </div>
            <div className="pc">
              <div>
                <b>{nAO}</b>🇦🇴 Angola
              </div>
              <div>
                <b>{nBR}</b>🇧🇷 Brasil
              </div>
            </div>
          </div>

          <div className="stage">
            <div className="phonecol">
              <div className="glass cur" role="group" aria-label="Moeda do exemplo">
                {LANDING_PREVIEW_ORDER.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={country === k}
                    onClick={() => setCountry(k)}
                  >
                    {LANDING_PREVIEW[k].flag} {LANDING_PREVIEW[k].cur}
                  </button>
                ))}
              </div>
              <div className="glass phone" aria-label="Pré-visualização do app">
                <div className="screen">
                  <div key={country} className="swap">
                    <div className="sh">
                      <span>Saldo projetado</span>
                      <span>12 meses</span>
                    </div>
                    <div className="bal">{d.bal}</div>
                    <div className="up">{d.up}</div>
                    <svg
                      className="chart"
                      viewBox="0 0 220 92"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#e3b93c" stopOpacity=".45" />
                          <stop offset="1" stopColor="#e3b93c" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 74 C25 70 35 52 60 56 S100 68 125 40 S180 24 220 10 V92 H0Z"
                        fill="url(#pg)"
                      />
                      <path
                        d="M0 74 C25 70 35 52 60 56 S100 68 125 40 S180 24 220 10"
                        fill="none"
                        stroke="#f6dc8a"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="220" cy="10" r="4" fill="#f6dc8a" />
                    </svg>
                    <div className="mini">
                      <div>
                        Gastos<b>{d.gastos}</b>
                      </div>
                      <div>
                        {d.meta[0]}
                        <b>{d.meta[1]}</b>
                      </div>
                    </div>
                    <div className="ask">{d.ask}</div>
                    <div className="chat">
                      <span>Copiloto Prumo</span>
                      {d.reply}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="feat">
              <div className="glass card">
                <div className="ico">
                  <Ico d={P.spark} s={20} />
                </div>
                <h3>Copiloto de IA que fala a sua língua</h3>
                <p>Respostas baseadas nas suas contas reais. Escreva ou pergunte por voz.</p>
              </div>
              <div className="glass card">
                <div className="flags" aria-hidden="true">
                  🇧🇷 🇦🇴
                </div>
                <h3>Brasil e Angola no mesmo app</h3>
                <p>R$ e Kz com dados separados por país, tudo offline e sincronizado depois.</p>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="glass chip" style={{ borderRadius: 99 }}>
              <Ico d={P.repeat} s={16} />
              Recorrências e parcelas automáticas
            </div>
            <div className="glass chip" style={{ borderRadius: 99 }}>
              <Ico d={P.file} s={16} />
              Extrato OFX e relatório em PDF
            </div>
          </div>
        </section>

        <aside className="glass auth" data-t={mode}>
          <div className="seg" data-t={mode} role="tablist">
            <div className="knob" />
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => switchMode('signup')}
            >
              Criar conta
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
            >
              Entrar
            </button>
          </div>
          <h2>{T[0]}</h2>
          <p className="sub">{T[1]}</p>

          <form onSubmit={handleSubmit}>
            <div className="name">
              <label htmlFor="n">Nome</label>
              <div className="field">
                <Ico d={P.user} />
                <input
                  id="n"
                  name="name"
                  placeholder="Como devemos chamar você?"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
            <label htmlFor="e">Email</label>
            <div className="field">
              <Ico d={P.mail} />
              <input
                id="e"
                name="email"
                type="email"
                required
                placeholder="voce@exemplo.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <label htmlFor="p">Senha</label>
            <div className="field">
              <Ico d={P.lock} />
              <input
                id="p"
                name="password"
                type="password"
                required
                minLength={mode === 'signup' ? 8 : undefined}
                placeholder="Sua senha"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn" type="submit" disabled={busy || offline} aria-busy={busy}>
              {busy ? 'Aguarde...' : T[2]}
            </button>
          </form>

          {error && (
            <div className="error" role="alert">
              <Ico d={P.alert} s={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="or">ou</div>
          <button className="ghost" type="button" onClick={handleGoogleAuth} disabled={busy}>
            <Google />
            Continuar com Google
          </button>
          <button className="ghost demo" type="button" onClick={onGuestMode}>
            <Ico d={P.play} fill="currentColor" />
            Explorar a demonstração sem conta
          </button>
          <div className="trust">
            <Ico d={P.shield} s={14} />
            Dados criptografados · Conforme a LGPD
          </div>
        </aside>
      </main>
    </div>
  );
};
