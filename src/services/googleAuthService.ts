/**
 * Cliente do login com Google (Fase 6) — frontend.
 * Carrega o script oficial GIS e envia o ID token ao servidor
 * (POST /api/sync { action:'google_auth' }), que valida no Google e cria a sessão.
 */
import { extractGoogleIdToken } from './googleAuthRules';

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
          prompt(): void;
        };
      };
    };
  }
}

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

let promptReady: ((cred: string) => void) | null = null;

/** Abre o popup do Google e devolve o ID token. */
export async function promptGoogleSignIn(clientId: string): Promise<string> {
  await loadGisScript();
  const gis = window.google?.accounts?.id;
  if (!gis) throw new Error('Google Identity Services indisponível');

  return new Promise<string>((resolve, reject) => {
    promptReady = (cred) => {
      promptReady = null;
      resolve(cred);
    };
    gis.initialize({
      client_id: clientId,
      callback: (response) => {
        const token = extractGoogleIdToken(response);
        if (token && promptReady) {
          promptReady(token);
        } else {
          promptReady = null;
          reject(new Error('Resposta do Google inválida'));
        }
      },
      cancel_on_tap_outside: true,
    });
    gis.prompt();
  });
}

/** Fluxo completo: pede token ao Google e valida no servidor (cria a sessão). */
export async function signInWithGoogle(): Promise<{ id: string; email: string; name: string; country: 'BR' | 'AO' }> {
  const clientId = await fetchGoogleClientId();
  if (!clientId) {
    throw new Error('Login com Google indisponível no servidor (GOOGLE_CLIENT_ID não configurado)');
  }
  const idToken = await promptGoogleSignIn(clientId);

  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'google_auth', idToken }),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.user) {
    throw new Error(data?.error || 'Falha no login com Google');
  }
  return data.user;
}
