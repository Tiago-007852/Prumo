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

/**
 * Traduz o motivo de o prompt One Tap não ter aparecido (API de notificação
 * do GIS) numa mensagem útil em português. silent=true = não mostrar erro
 * (usuário apenas fechou/skip benigno).
 */
export function humanizeGooglePromptIssue(
  kind: 'not_displayed' | 'skipped' | 'dismissed',
  reason: string | null | undefined,
  inIframe: boolean
): { message: string | null; silent: boolean } {
  const r = String(reason || '');

  // Usuário fechou o prompt — nunca é erro visível
  if (kind === 'dismissed') return { message: null, silent: true };
  if (kind === 'skipped' && (r === 'user_cancel' || r === 'user_closed' || r === 'tap_outside')) {
    return { message: null, silent: true };
  }

  const iframeHint = inIframe
    ? ' Nota: estás numa janela incorporada (preview) — abre o Prumo numa aba própria para o Google permitir o login.'
    : '';

  switch (r) {
    case 'third_party_cookies_blocked':
      return {
        message: `O navegador bloqueou os cookies do Google, necessários para o login rápido.${iframeHint} Alternativa: entrar com email e senha.`,
        silent: false,
      };
    case 'opt_out_or_no_session':
      return { message: `Não há sessão Google ativa neste navegador. Entra no Gmail nesta aba e tenta de novo.${iframeHint}`, silent: false };
    case 'unregistered_origin':
      return {
        message: `Este site ainda não está autorizado nas configurações do Google Cloud. No Google Cloud → APIs & Services → Credentials → teu OAuth client → Authorized JavaScript origins, adiciona exatamente o endereço atual (${typeof window !== 'undefined' && typeof location !== 'undefined' ? location.origin : 'https://prumo-premium.vercel.app'}) e aguarda alguns minutos.`,
        silent: false,
      };
    case 'invalid_parameter':
      return { message: 'O Google rejeitou a configuração do login (client_id ou parâmetro inválido). Verifica o GOOGLE_CLIENT_ID configurado no servidor.', silent: false };
    case 'suppressed_by_user':
      return {
        message: 'O Google ocultou o login rápido porque foi fechado anteriormente. Tenta de novo em instantes ou usa email e senha.',
        silent: false,
      };
    case 'browser_not_supported':
      return { message: 'Este navegador não suporta o login rápido do Google — usa Chrome/Edge ou email e senha.', silent: false };
    case 'insecure_transport':
    case 'secure_context_required':
      return { message: 'O login do Google exige HTTPS.', silent: false };
    default:
      // Motivo não mapeado: mostrar o código cru para diagnóstico imediato.
      return { message: `O Google não conseguiu mostrar a janela de login (motivo: ${r || 'desconhecido'}).${iframeHint} Alternativa: entrar com email e senha.`, silent: false };
  }
}
