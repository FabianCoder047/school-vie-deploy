// =====================================================================
// Feu vert du directeur — autorisation permanente (activable/désactivable)
// d'impression des cartes scolaires ou des bulletins par la SECRÉTAIRE.
// Le DIRECTEUR n'y est pas contraint ; la SECRÉTAIRE reçoit 403
// IMPRESSION_NON_AUTORISEE tant que l'autorisation est coupée.
// =====================================================================
const pool = require('../config/db');
const settingsRepo = require('../repositories/settingsRepository');
const notificationRepo = require('../repositories/notificationRepository');
const { log: audit } = require('../repositories/auditRepository');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');

const TYPES = {
  cartes: { colonne: 'cartes_impression_autorisee', titre: 'Cartes scolaires', genre: 'des cartes scolaires' },
  bulletins: { colonne: 'bulletins_impression_autorisee', titre: 'Bulletins', genre: 'des bulletins' },
  edts: { colonne: 'edts_impression_autorisee', titre: 'Emplois du temps', genre: 'des emplois du temps' },
};

/** Active ou révoque l'autorisation d'impression ; notifie les secrétaires ; trace l'audit. */
async function basculer(type, autorisee, actorId, ip) {
  const cfg = TYPES[type];
  if (!cfg) throw ApiError.badRequest('Type d’autorisation invalide (cartes, bulletins ou edts).', 'TYPE_INVALIDE');
  const avant = await settingsRepo.get();
  const parametres = await settingsRepo.setAutorisationImpression(type, autorisee);

  await audit({
    userId: actorId,
    action: 'UPDATE_FEUVERT',
    entity: 'impression',
    entityId: null,
    oldValues: { type, autorisee: Boolean(avant?.[cfg.colonne]) },
    newValues: { type, autorisee: Boolean(autorisee) },
    ipAddress: ip,
  });

  // Prévenir les secrétaires actifs (cloche de la topbar) — jamais bloquant.
  try {
    const [secretaires] = await pool.query("SELECT id FROM users WHERE role = 'SECRETAIRE' AND is_active = 1");
    await Promise.all(
      secretaires.map((s) =>
        notificationRepo.create({
          user_id: s.id,
          type: 'SYSTEME',
          titre: autorisee ? `Feu vert — ${cfg.titre}` : `Feu vert retiré — ${cfg.titre}`,
          message: autorisee
            ? `Le directeur autorise la secrétaire à imprimer ${cfg.genre}.`
            : `Le directeur a retiré l’autorisation d’impression ${cfg.genre}.`,
          data: { type, autorisee: Boolean(autorisee) },
        })
      )
    );
  } catch (err) {
    logger.error('Notification feu vert non créée', { message: err.message, type });
  }

  return { parametres };
}

module.exports = { basculer, TYPES };
