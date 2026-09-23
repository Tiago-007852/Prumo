/**
 * Diagnóstico temporário: testa (1) resolução de node_modules na Vercel e
 * (2) conectividade real com o Neon usando DATABASE_URL de produção.
 * Nunca expõe segredos — apenas status e códigos de erro.
 */
let neon = null;
try {
  ({ neon } = require('@neondatabase/serverless'));
} catch (e) {
  neon = null;
}

module.exports = async (req, res) => {
  const out = { ok: true, driverLoaded: !!neon, dbConfigured: !!process.env.DATABASE_URL };
  try {
    if (!neon) {
      out.db = 'driver_unavailable';
    } else if (!process.env.DATABASE_URL) {
      out.db = 'missing_url';
    } else {
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`SELECT 1 AS one`;
      out.db = rows.length > 0 ? 'connected' : 'empty';
    }
  } catch (err) {
    out.db = 'error';
    out.code = err && err.code ? err.code : undefined;
    out.message = String((err && err.message) || err).slice(0, 160);
  }
  res.status(200).json(out);
};
