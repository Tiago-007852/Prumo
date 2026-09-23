/**
 * Cliente de autenticação do Prumo (frontend).
 * Cookie httpOnly gerencia a sessão — aqui só orquestramos as chamadas.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  country: 'BR' | 'AO';
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

export async function register(email: string, password: string, name: string, country: 'BR' | 'AO'): Promise<AuthUser> {
  const res = await postJson('/api/auth/register', { email, password, name, country });
  if (!res.ok) throw new Error(await readError(res, 'Falha ao criar conta'));
  const data = await res.json();
  return data.user as AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await postJson('/api/auth/login', { email, password });
  if (!res.ok) throw new Error(await readError(res, 'Email ou senha incorretos'));
  const data = await res.json();
  return data.user as AuthUser;
}

export async function logout(): Promise<void> {
  await postJson('/api/auth/logout', {});
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.user as AuthUser) || null;
  } catch {
    return null;
  }
}

/** Baixa o JSON de exportação LGPD (direito de portabilidade). */
export async function exportMyData(): Promise<void> {
  const res = await fetch('/api/account/export', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Falha ao exportar dados');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prumo_meus_dados_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Elimina permanentemente a conta e todos os dados (direito de eliminação). */
export async function deleteMyAccount(email: string): Promise<void> {
  const res = await postJson('/api/account/delete', { confirm: email });
  if (!res.ok) throw new Error(await readError(res, 'Falha ao eliminar conta'));
}
