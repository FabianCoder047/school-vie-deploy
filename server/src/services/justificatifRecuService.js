// Preuve scannée du reçu (le reçu est rempli à la main par le secrétaire
// ou le comptable ; le fichier — PDF/photo — est joint « en cas de quoi »).
const fs = require('fs');
const path = require('path');
const paymentRepo = require('../repositories/paymentRepository');
const { ApiError } = require('../utils/ApiError');
const { log: audit } = require('../repositories/auditRepository');
const { DOSSIER_UPLOADS } = require('../middlewares/upload');

/** Suppression best-effort d'un fichier /uploads/justificatifs/… (jamais ailleurs). */
function supprimerFichier(cheminPublic) {
  if (!cheminPublic || !String(cheminPublic).startsWith('/uploads/justificatifs/')) return;
  const fichier = path.basename(cheminPublic);
  fs.unlink(path.join(DOSSIER_UPLOADS, 'justificatifs', fichier), () => {});
}

/** Pose (ou remplace) le justificatif scanné d'un paiement. */
async function poser(paymentId, file, actorId, ip) {
  if (!file) throw ApiError.badRequest('Aucun fichier reçu.', 'FICHIER_REQUIS');
  const payment = await paymentRepo.findById(paymentId);
  if (!payment) {
    fs.unlink(file.path, () => {});
    throw ApiError.notFound('Paiement introuvable.', 'PAIEMENT_INTROUVABLE');
  }
  if (payment.justificatif_chemin) supprimerFichier(payment.justificatif_chemin);
  const chemin = `/uploads/justificatifs/${file.filename}`;
  const maj = await paymentRepo.setJustificatif(paymentId, chemin);
  await audit({
    userId: actorId,
    action: 'JUSTIFICATIF_RECU_POSE',
    entity: 'payments',
    entityId: paymentId,
    newValues: { fichier: file.filename, type: payment.type, montant: payment.montant },
    ipAddress: ip,
  });
  return { ok: true, justificatif_chemin: maj.justificatif_chemin, justificatif_at: maj.justificatif_at };
}

/** Retire le justificatif scanné d'un paiement (fichier supprimé). */
async function retirer(paymentId, actorId, ip) {
  const payment = await paymentRepo.findById(paymentId);
  if (!payment) throw ApiError.notFound('Paiement introuvable.', 'PAIEMENT_INTROUVABLE');
  if (payment.justificatif_chemin) supprimerFichier(payment.justificatif_chemin);
  await paymentRepo.setJustificatif(paymentId, null);
  await audit({
    userId: actorId,
    action: 'JUSTIFICATIF_RECU_RETIRE',
    entity: 'payments',
    entityId: paymentId,
    newValues: { ancien_fichier: payment.justificatif_chemin },
    ipAddress: ip,
  });
  return { ok: true };
}

module.exports = { poser, retirer };
