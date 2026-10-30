/**
 * Cliente do login com Google (Fase 6) — frontend.
 * Carrega o script oficial GIS e envia o ID token ao servidor
 * (POST /api/sync { action:'google_auth' }), que valida no Google e cria a sessão.
 *
 * Robustez: escuta as notificações do prompt (not_displayed/skipped/dismissed)
 * para traduzir falhas silenciosas em mensagens úteis — o bug "fica em
 * Aguarde para sempre" era exatamente a falta desses listeners.
 * Timeout de 12s: se nada acontecer (ex.: script bloqueado), destrava o botão.
 */
import { extractGoogleIdToken, humanizeGooglePromptIssue } from './googleAuthRules';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
          prompt(listener?: (notification: GooglePromptNotification) => void): void;
        };
      };
    };
  }
}

/** Notificação do GIS sobre o ciclo de vida do prompt One Tap. */
interface GooglePromptNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
  getNotDisplayedReason(): string;
  getSkippedReason(): string;
  getDismissedReason(): string;
}

const PROMPT_TIMEOUT_MS = 12_000;

/** Busca o client_id publicável no /api/health. */
export async function fetchGoogleClientId(): Promise<string | null> {
  try {
    const res = await fetch('/api/health', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.googleClientId as string) || null;
  } catch {
    return null;
  }
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('sem window'));
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google Identity Services')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.setAttribute('data-gis', 'true');
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar Google Identity Services'));
    document.head.appendChild(s);
  });
}

/** Estamos numa iframe (preview do Freebuff/Studio)? */
function isInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true; // cross-origin access = iframe
  }
}

/**
 * Abre o popup do Google e devolve o ID token.
 * Rejeita com mensagem humana (pt) quando o prompt não aparece ou é fechado.
 */
export async function promptGoogleSignIn(clientId: string): Promise<string> {
  await loadGisScript();
  const gis = window.google?.accounts?.id;
  if (!gis) throw new Error('Google Identity Services indisponível (script bloqueado?)');

  const inIframe = isInIframe();

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finishResolve = (cred: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(cred);
    };
    const finishReject = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    };

    // Destrava o botão se nada acontecer (popup bloqueado, script travado…)
    const timer = setTimeout(() => {
      finishReject(new Error(
        inIframe
          ? 'O Google não conseguiu abrir o login dentro desta janela incorporada. Abre o Prumo numa aba própria do navegador e tenta de novo.'
          : 'O Google demorou demasiado a responder. Tenta de novo em instantes ou usa email e senha.'
      ));
    }, PROMPT_TIMEOUT_MS);

    gis.initialize({
      client_id: clientId,
      callback: (response) => {
        const token = extractGoogleIdToken(response);
        if (token) {
          finishResolve(token);
        } else {
          finishReject(new Error('Resposta do Google inválida'));
        }
      },
      cancel_on_tap_outside: true,
    });

    // O listener de momentos passa-se como argumento de prompt() — é assim que
    // ficamos a saber POR QUE o prompt não apareceu (docs oficiais GIS).
    gis.prompt((notification) => {
      if (settled) return;
      if (notification.isNotDisplayed()) {
        const { message } = humanizeGooglePromptIssue('not_displayed', notification.getNotDisplayedReason(), inIframe);
        finishReject(new Error(message || 'O Google não conseguiu mostrar a janela de login.'));
      } else if (notification.isSkippedMoment()) {
        const { message, silent } = humanizeGooglePromptIssue('skipped', notification.getSkippedReason(), inIframe);
        if (!silent) finishReject(new Error(message || 'Login rápido do Google indisponível agora.'));
        // silent (usuário cancelou): não é erro
        else finishReject(new Error('GOOGLE_SILENT_CANCEL'));
      } else if (notification.isDismissedMoment()) {
        const { message, silent } = humanizeGooglePromptIssue('dismissed', notification.getDismissedReason(), inIframe);
        if (!silent) finishReject(new Error(message || 'Login cancelado.'));
        else finishReject(new Error('GOOGLE_SILENT_CANCEL'));
      }
    });
  });
}

/**
 * Fluxo completo: pede token ao Google e valida no servidor (cria a sessão).
 * `country` só é usado quando a conta é NOVA (o servidor ignora para contas
 * existentes) — evita que todo angolano que entre pelo Google vire 'BR'.
 */
export async function signInWithGoogle(
  country?: 'BR' | 'AO'
): Promise<{ id: string; email: string; name: string; country: 'BR' | 'AO' }> {
  const clientId = await fetchGoogleClientId();
  if (!clientId) {
    throw new Error('Login com Google indisponível no servidor (GOOGLE_CLIENT_ID não configurado)');
  }
  const idToken = await promptGoogleSignIn(clientId);

  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'google_auth', idToken, country }),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.user) {
    throw new Error(data?.error || 'Falha no login com Google');
  }
  return data.user;
}
