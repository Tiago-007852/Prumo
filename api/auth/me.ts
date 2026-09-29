import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserByToken } from '../_lib/auth';
import { readSessionToken } from '../_lib/http';
import { getAccess, ensurePaymentsSchema } from '../_lib/payments';
import { isAdminEmail } from '../_lib/admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  const user = await getUserByToken(readSessionToken(req.headers.cookie));
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    // Migração idempotente das colunas de acesso + estado do paywall (Fase 5).
    // Colunas novas nascem com has_access = true — usuários antigos grandfathered.
    await ensurePaymentsSchema();
    const access = await getAccess(user.id);
    // Painel Admin: flag para mostrar/ocultar a tab (verificação real nas actions)
    return res.status(200).json({ user, access, isAdmin: isAdminEmail(user.email) });
  } catch (err: any) {
    console.error('Erro ao carregar acesso (/me):', err);
    // Falha de schema/pagamentos não pode derrubar o login — degrade aberto.
    return res.status(200).json({
      user,
      access: { hasAccess: true, accessUntil: null, stripeConfigured: false, priceConfigured: false },
      isAdmin: false,
    });
  }
}
