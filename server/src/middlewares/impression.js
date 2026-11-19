// Feu vert : bloque la génération des documents par la SECRÉTAIRE tant que
// le directeur n'a pas (ré)activé l'autorisation correspondante.
// Le DIRECTEUR n'est jamais contraint (routes partagées avec l'EDT).
const settingsRepo = require('../repositories/settingsRepository');
const { ApiError } = require('../utils/ApiError');

const COLONNES = {
  cartes: 'cartes_impression_autorisee',
  bulletins: 'bulletins_impression_autorisee',
  edts: 'edts_impression_autorisee',
};
const LIBELLES = {
  cartes: 'des cartes scolaires',
  bulletins: 'des bulletins',
  edts: 'des emplois du temps',
};

function verifierFeuVert(type) {
  return async function feuVertMiddleware(req, _res, next) {
    try {
      if (req.user?.role === 'DIRECTEUR') return next();
      const settings = await settingsRepo.get();
      if (!settings?.[COLONNES[type]]) {
        throw ApiError.forbidden(
          `Le directeur n’a pas encore donné le feu vert pour l’impression ${LIBELLES[type]}.`,
          'IMPRESSION_NON_AUTORISEE'
        );
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { verifierFeuVert };
