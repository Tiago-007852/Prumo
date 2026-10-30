/**
 * Sugestão do país da conta a partir da região do browser.
 *
 * O registo por email e o login com Google nasciam sempre com o país 'BR'
 * (fixo no schema), o que deixava um utilizador angolano a ver reais, o funil
 * brasileiro e o copiloto em R$. Aqui usamos os dois sinais fiáveis do lado do
 * cliente — fuso horário e idioma — e caímos em BR quando não há sinal.
 *
 * É só uma sugestão: o país real pode ser corrigido no perfil (que agora
 * persiste na conta) e nunca vem do servidor sem validação.
 */

export type AccountCountry = 'BR' | 'AO';

const ANGOLA_TIMEZONE = 'Africa/Luanda';

export function detectDefaultCountry(): AccountCountry {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (timeZone === ANGOLA_TIMEZONE) return 'AO';

    const languages =
      typeof navigator !== 'undefined'
        ? navigator.languages?.length
          ? navigator.languages
          : [navigator.language]
        : [];
    const lang = String(languages[0] || '').toLowerCase();
    if (lang === 'pt-ao' || lang.endsWith('-ao')) return 'AO';
  } catch {
    // Sem Intl/navigator (SSR, browser antigo) — segue o padrão.
  }
  return 'BR';
}
