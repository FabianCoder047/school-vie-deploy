// Publication de communiqués ciblés + génération des notifications
// pour chaque destinataire concerné (une ligne par destinataire).
const { ApiError } = require('../utils/ApiError');
const pool = require('../config/db');
const announcementRepo = require('../repositories/announcementRepository');
const notificationRepo = require('../repositories/notificationRepository');
const { log: audit } = require('../repositories/auditRepository');
const logger = require('../utils/logger');

const TYPES_CIBLES = ['TOUS', 'ROLE', 'CYCLE', 'CLASSE', 'ALIAS'];
const ROLES = ['ADMIN', 'DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'PROFESSEUR', 'PARENT'];

/** Publie un communiqué : crée l'annonce, ses cibles et les notifications. */
async function publier({ titre, contenu, cibles }, actorId, ip) {
  if (!titre?.trim() || !contenu?.trim()) {
    throw ApiError.badRequest('Le titre et le contenu sont requis.', 'COMMUNIQUE_VIDE');
  }
  if (!Array.isArray(cibles) || cibles.length === 0) {
    throw ApiError.badRequest('Choisissez au moins un destinataire.', 'CIBLES_REQUISES');
  }
  // Validation des cibles
  for (const cible of cibles) {
    if (!TYPES_CIBLES.includes(cible.target_type)) {
      throw ApiError.badRequest('Type de cible invalide.', 'CIBLE_INVALIDE');
    }
    if (cible.target_type === 'ROLE' && !ROLES.includes(cible.role)) {
      throw ApiError.badRequest('Rôle de cible invalide.', 'ROLE_CIBLE_INVALIDE');
    }
    if (cible.target_type === 'CYCLE' && !cible.cycle_id) throw ApiError.badRequest('Cycle requis.', 'CIBLE_INCOMPLETE');
    if (cible.target_type === 'CLASSE' && !cible.class_id) throw ApiError.badRequest('Classe requise.', 'CIBLE_INCOMPLETE');
    if (cible.target_type === 'ALIAS' && !cible.class_alias_id) throw ApiError.badRequest('Alias requis.', 'CIBLE_INCOMPLETE');
  }

  const conn = await pool.getConnection();
  let announcementId;
  try {
    await conn.beginTransaction();
    announcementId = await announcementRepo.createAnnouncement(
      { titre: titre.trim(), contenu: contenu.trim(), auteur_id: actorId },
      conn
    );
    for (const cible of cibles) {
      // eslint-disable-next-line no-await-in-loop
      await announcementRepo.addTarget(announcementId, {
        target_type: cible.target_type,
        role: cible.role || null,
        cycle_id: cible.cycle_id || null,
        class_id: cible.class_id || null,
        class_alias_id: cible.class_alias_id || null,
      }, conn);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Résolution des destinataires + notifications (post-commit).
  let destinataires = [];
  try {
    destinataires = await announcementRepo.resolveDestinataires(cibles);
    if (destinataires.length > 0) {
      await Promise.all(
        destinataires.map((userId) =>
          notificationRepo.create({
            user_id: userId,
            type: 'COMMUNIQUE',
            titre: `Communiqué — ${titre.trim()}`,
            message: contenu.trim().length > 300 ? `${contenu.trim().slice(0, 300)}…` : contenu.trim(),
            data: { announcementId },
          })
        )
      );
    }
  } catch (err) {
    // Le communiqué est publié même si la notification échoue (les cibles restent).
    logger.error('Notifications de communiqué non créées', { message: err.message, announcementId });
  }

  await audit({
    userId: actorId,
    action: 'CREATE',
    entity: 'announcements',
    entityId: announcementId,
    newValues: { titre: titre.trim(), cibles, destinataires: destinataires.length },
    ipAddress: ip,
  });

  return { announcementId, destinataires: destinataires.length };
}

async function listerCommuniques() {
  return announcementRepo.listAll();
}

/** Communiqués pour le tableau de bord de l'utilisateur : pilotage → tout ; autres rôles → ceux qui les concernent. */
async function listerPourMoi(user) {
  if (user?.role === 'ADMIN' || user?.role === 'DIRECTEUR' || user?.role === 'SECRETAIRE') {
    return announcementRepo.listAll();
  }
  return announcementRepo.listForUser(user);
}

module.exports = { publier, listerCommuniques, listerPourMoi };
