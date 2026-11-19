// Feu vert : bloque la génération des documents par la SECRÉTAIRE tant que
// le directeur n'a pas (ré)activé l'autorisation correspondante.
const settingsRepo = require('../repositories/settingsRepository');
const { ApiError } = require('../utils/ApiError');

function verifierFeuVert(type) {
  return async function feuVertMiddleware(req, _res, next) {
    try {
      const settings = await settingsRepo.get();
      const ok = type === 'cartes' ? settings?.cartes_impression_autorisee : settings?.bulletins_impression_autorisee;
      if (!ok) {
        throw ApiError.forbidden(
          type === 'cartes'
            ? 'Le directeur n’a pas encore donné le feu vert pour l’impression des cartes scolaires.'
            : 'Le directeur n’a pas encore donné le feu vert pour l’impression des bulletins.',
          'IMPRESSION_NON_AUTORISEE'
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { verifierFeuVert };
