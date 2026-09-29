/**
 * Regras puras do login com Google (Fase 6) — sem I/O, testáveis.
 * Usadas por LoginView (GIS callback) e pelos testes phase6.
 */

/** Resposta mínima do callback do Google Identity Services. */
export interface GoogleCredential {
  credential?: string;
}

/**
 * Extrai o ID token (JWT) do callback do GIS e valida o formato JWT
 * (3 segmentos base64url). Devolve null se inválido.
 */
export function extractGoogleIdToken(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null;
  const cred = (response as GoogleCredential).credential;
  if (typeof cred !== 'string') return null;
  const parts = cred.split('.');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) return null;
  return cred;
}

/** Client ID do Google parece válido (formato xxxx.apps.googleusercontent.com). */
export function isPlausibleGoogleClientId(clientId: unknown): boolean {
  return typeof clientId === 'string' && /^[0-9A-Za-z-]+\.apps\.googleusercontent\.com$/.test(clientId);
}
