// =====================================================================
// Logger minimal (niveaux info / warn / error) — évite de dépendre
// d'une librairie lourde ; format horodaté, une ligne par événement.
// Ne JAMAIS journaliser de mot de passe ni de hash.
// =====================================================================
function format(level, message, meta) {
  const base = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  return meta ? `${base} ${typeof meta === 'string' ? meta : JSON.stringify(meta)}` : base;
}

module.exports = {
  info: (message, meta) => console.log(format('info', message, meta)),
  warn: (message, meta) => console.warn(format('warn', message, meta)),
  error: (message, meta) => console.error(format('error', message, meta)),
};
