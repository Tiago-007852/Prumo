/**
 * Limite de pedidos por chave (janela fixa), guardado no Neon.
 *
 * Existe porque o `/api/copiloto` estava aberto a qualquer bot (quota de IA
 * queimada) e o `/api/auth/login` aceitava tentativas ilimitadas. Vive numa
 * tabela própria para não gastar uma função serverless (a Vercel Hobby está
 * no limite de 12).
 *
 * Fail-open por desenho: se a base de dados falhar, o pedido passa — é melhor
 * arriscar abuso do que bloquear login e copiloto por causa do limitador.
 */
import { getSql } from './db';

let _schemaReady: Promise<void> | null = null;

function ensureRateLimitSchema(): Promise<void> {
  if (!_schemaReady) {
    _schemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS rate_limits (
          key          TEXT PRIMARY KEY,
          window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
          count        INTEGER NOT NULL DEFAULT 0
        )
      `;
    })().catch((err) => {
      _schemaReady = null; // permite retry na próxima chamada
      throw err;
    });
  }
  return _schemaReady;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Conta um pedido na chave e diz se ainda está dentro do limite. */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    await ensureRateLimitSchema();
    const sql = getSql();

    // Incremento atómico: a janela reinicia quando expirou, senão soma 1.
    // Duas instâncias serverless concorrentes nunca passam do limite.
    const rows = (await sql`
      INSERT INTO rate_limits (key, window_start, count)
      VALUES (${key}, now(), 1)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start < now() - (${windowSeconds}::int * interval '1 second') THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < now() - (${windowSeconds}::int * interval '1 second') THEN now()
          ELSE rate_limits.window_start
        END
      RETURNING count,
        GREATEST(
          0,
          EXTRACT(EPOCH FROM (window_start + (${windowSeconds}::int * interval '1 second') - now()))
        )::int AS retry_after
    `) as { count: number; retry_after: number }[];

    const row = rows[0];
    if (!row) return { allowed: true, remaining: limit, retryAfterSeconds: 0 };

    // Higiene oportunista (~2% dos pedidos): remove janelas antigas para a
    // tabela não crescer sem limite com IPs/utilizadores que já não voltam.
    if (Math.random() < 0.02) {
      sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`.catch(() => {});
    }

    return {
      allowed: row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      retryAfterSeconds: Math.max(0, Number(row.retry_after) || 0),
    };
  } catch (err) {
    console.error('[rateLimit] falhou (a permitir o pedido):', err);
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Chave a partir do IP do pedido (Vercel: x-forwarded-for; Express: req.ip). */
export function clientIp(headers: Record<string, unknown> | undefined, fallback?: string): string {
  const forwarded = headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = String(raw || '')
    .split(',')[0]
    .trim();
  return first || fallback || 'desconhecido';
}

/** Mensagem pronta para o utilizador quando o limite é atingido. */
export function rateLimitMessage(result: RateLimitResult): string {
  const seconds = Math.max(1, result.retryAfterSeconds);
  const minutes = Math.ceil(seconds / 60);
  return minutes > 1
    ? `Demasiados pedidos em pouco tempo. Tente novamente em ${minutes} minutos.`
    : `Demasiados pedidos em pouco tempo. Tente novamente em ${seconds} segundos.`;
}
