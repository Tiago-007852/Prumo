/**
 * Cliente do espaço compartilhado (casal/família) para o frontend.
 * Fala com /api/space (serverless na Vercel, Express em dev).
 */

import type { SharedSpace } from '../types';

export interface SpaceSummaryMember {
  userId: string;
  name: string;
  role: string;
  balance: number;
  monthExpense: number;
}

export interface SpacePayload {
  space: SharedSpace | null;
  summary?: SpaceSummaryMember[];
}

function normalizeSpace(raw: unknown): SharedSpace | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  return {
    id: String(s.id || ''),
    name: String(s.name || 'Espaço'),
    ownerUserId: String(s.ownerUserId || ''),
    country: s.country === 'AO' ? 'AO' : 'BR',
    inviteCode: String(s.inviteCode || ''),
    createdAt: String(s.createdAt || new Date().toISOString()),
    members: Array.isArray(s.members)
      ? s.members.map((m: Record<string, unknown>) => ({
          userId: String(m.userId),
          name: String(m.name),
          email: String(m.email),
          role: m.role === 'owner' ? 'owner' : 'member',
          joinedAt: String(m.joinedAt || new Date().toISOString()),
        }))
      : [],
    settings:
      s.settings && typeof s.settings === 'object'
        ? (s.settings as { detailLevel?: 'full' | 'summary' })
        : undefined,
  };
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || 'Falha na requisição');
  }
  return data as T;
}

/** Carrega o espaço do usuário (ou null se não participa de nenhum). */
export async function fetchSpace(): Promise<SpacePayload> {
  const data = await request<{ space: unknown; summary?: SpaceSummaryMember[] }>('/api/space');
  return { space: normalizeSpace(data.space), summary: data.summary || [] };
}

/** Cria um espaço compartilhado. */
export async function createSpace(name: string): Promise<SpacePayload> {
  const data = await request<{ space: unknown; summary?: SpaceSummaryMember[] }>('/api/space', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return { space: normalizeSpace(data.space), summary: data.summary || [] };
}

/** Entra num espaço pelo código de convite. */
export async function joinSpaceByCode(code: string): Promise<SpacePayload> {
  const data = await request<{ space: unknown; summary?: SpaceSummaryMember[] }>('/api/space', {
    method: 'POST',
    body: JSON.stringify({ action: 'join', code }),
  });
  return { space: normalizeSpace(data.space), summary: data.summary || [] };
}

/** Sai do espaço (membro) ou encerra (dono). */
export async function leaveSpace(): Promise<void> {
  await request('/api/space', {
    method: 'POST',
    body: JSON.stringify({ action: 'leave' }),
  });
}
