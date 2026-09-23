/**
 * Helpers compartilhados para handlers HTTP (Express e Vercel).
 * Extração de sessão a partir do cookie, parsing de body e respostas de erro.
 */
import { SESSION_COOKIE, getUserByToken, type AuthUser } from './auth';

/** Lê o token de sessão do header Cookie. */
export function readSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE) {
      return rest.join('=');
    }
  }
  return null;
}

export interface RequestLike {
  method?: string;
  headers: { cookie?: string };
}

export interface ResponseLike {
  status(code: number): { json(body: unknown): unknown } | ResponseLike;
  json(body: unknown): unknown;
  setHeader?(name: string, value: string): void;
}

/** Resolve o usuário autenticado da requisição (ou null). */
export async function requireUser(req: RequestLike): Promise<AuthUser | null> {
  const token = readSessionToken(req.headers?.cookie);
  return getUserByToken(token);
}

/** Resposta padronizada 401. */
export function unauthorized(res: ResponseLike) {
  return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
}

/** Faz o parse seguro do body JSON (string ou objeto). */
export function parseBody(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}
