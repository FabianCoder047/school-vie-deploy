// Gestionnaire d'erreurs central : ApiError → status/message ;
// erreur inconnue → 500 générique (détail uniquement côté logs).
const logger = require('../utils/logger');
const { ApiError } = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError || err.isOperational) {
    const body = { message: err.message };
    if (err.code) body.code = err.code;
    if (err.errors) body.errors = err.errors;
    return res.status(err.status || 500).json(body);
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Requête trop volumineuse.' });
  }
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ message: 'Corps de requête JSON invalide.' });
  }
  logger.error('Erreur non gérée', { message: err?.message, stack: err?.stack, path: req?.path });
  return res.status(500).json({ message: 'Une erreur interne est survenue.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Route introuvable.' });
}

module.exports = { errorHandler, notFoundHandler };
