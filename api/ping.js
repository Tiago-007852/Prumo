/**
 * Diagnóstico temporário: função JS pura, zero dependências.
 * Se até ela falhar na Vercel, o problema é da plataforma/build — não do código.
 */
module.exports = async (req, res) => {
  res.status(200).json({ ok: true, ping: 'pong', ts: new Date().toISOString() });
};
