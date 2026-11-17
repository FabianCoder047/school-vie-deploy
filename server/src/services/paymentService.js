// =====================================================================
// Paiements (scolarité + inscription).
// - Écriture en transaction SQL, montants en DECIMAL.
// - Ventilation automatique sur les échéances, les plus anciennes d'abord.
// - Aucune suppression : annulation avec motif + audit_logs.
// =====================================================================
const pool = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const enrollmentRepo = require('../repositories/enrollmentRepository');
const scheduleRepo = require('../repositories/paymentScheduleRepository');
const paymentRepo = require('../repositories/paymentRepository');
const { nextReceiptNumber } = require('../utils/sequences');
const { log: audit } = require('../repositories/auditRepository');

const MOYENS = ['ESPECES', 'FLOOZ', 'MIXX_BY_YAS'];

/** Résumé financier d'une inscription (totaux échéances + statut). */
function calculerStatut(totalDu, totalPaye, echeances, dateDuJour) {
  const reste = Number((totalDu - totalPaye).toFixed(2));
  if (reste <= 0) return 'SOLDE';
  const retard = echeances.some(
    (e) => e.statut !== 'PAYE' && String(e.date_echeance).slice(0, 10) < dateDuJour
  );
  return retard ? 'EN_RETARD' : 'A_JOUR';
}

/** Situation complète (fiche + échéances + paiements + totaux). */
async function situation(enrollmentId) {
  const fiche = await enrollmentRepo.findById(enrollmentId);
  if (!fiche) throw ApiError.notFound('Inscription introuvable.');
  const [echeances, payments] = await Promise.all([
    scheduleRepo.listByEnrollment(enrollmentId),
    paymentRepo.listByEnrollment(enrollmentId),
  ]);
  const totalDu = echeances.reduce((acc, e) => acc + Number(e.montant_du), 0);
  const totalPaye = echeances.reduce((acc, e) => acc + Number(e.montant_paye), 0);
  const dateDuJour = new Date().toISOString().slice(0, 10);
  return {
    fiche,
    echeances,
    payments,
    paiementInscription: payments.find((p) => p.type === 'INSCRIPTION' && p.statut === 'VALIDE') || null,
    total_du: totalDu.toFixed(2),
    total_paye: totalPaye.toFixed(2),
    reste: (totalDu - totalPaye).toFixed(2),
    statut_scolarite: calculerStatut(totalDu, totalPaye, echeances, dateDuJour),
  };
}

/** Marque le paiement des FRAIS D'INSCRIPTION (rôle Secrétaire). */
async function payerFraisInscription(enrollmentId, { moyen, reference_transaction, montant, date_paiement }, actorId, ip) {
  if (!MOYENS.includes(moyen)) throw ApiError.badRequest('Moyen de paiement invalide (ESPECES, FLOOZ, MIXX_BY_YAS).', 'MOYEN_INVALIDE');
  const fiche = await enrollmentRepo.findById(enrollmentId);
  if (!fiche) throw ApiError.notFound('Inscription introuvable.');
  if (await paymentRepo.existsInscriptionValide(enrollmentId)) {
    throw ApiError.conflict('Les frais d’inscription sont déjà payés pour cet élève.', 'INSCRIPTION_DEJA_PAYEE');
  }
  const montantDecimal = montant != null ? Number(montant) : Number(fiche.frais_inscription);
  if (!(montantDecimal > 0)) throw ApiError.badRequest('Le montant doit être strictement positif.', 'MONTANT_INVALIDE');
  if (montantDecimal > Number(fiche.frais_inscription)) {
    throw ApiError.badRequest(`Le montant dépasse les frais d’inscription (${fiche.frais_inscription} FCFA).`, 'MONTANT_DEPASSE');
  }

  const conn = await pool.getConnection();
  let paymentId;
  try {
    await conn.beginTransaction();
    const annee = new Date().getFullYear();
    const numeroRecu = await nextReceiptNumber(annee, conn);
    paymentId = await paymentRepo.create(
      {
        enrollment_id: enrollmentId,
        type: 'INSCRIPTION',
        montant: montantDecimal.toFixed(2),
        moyen,
        reference_transaction: reference_transaction?.trim() || null,
        numero_recu: numeroRecu,
        date_paiement: date_paiement || new Date(),
        created_by: actorId,
      },
      conn
    );
    await enrollmentRepo.setStatut(enrollmentId, 'INSCRIT', conn);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await audit({ userId: actorId, action: 'CREATE', entity: 'payments', entityId: paymentId, newValues: { type: 'INSCRIPTION', enrollmentId, montant: montantDecimal, moyen }, ipAddress: ip });
  return paymentRepo.findById(paymentId);
}

/**
 * Enregistre un paiement de SCOLARITÉ et ventile automatiquement sur
 * les échéances (les plus anciennes d'abord). Tout ou rien.
 */
async function payerScolarite({ enrollment_id, montant, moyen, reference_transaction, date_paiement }, actorId, ip) {
  if (!MOYENS.includes(moyen)) throw ApiError.badRequest('Moyen de paiement invalide (ESPECES, FLOOZ, MIXX_BY_YAS).', 'MOYEN_INVALIDE');
  const fiche = await enrollmentRepo.findById(enrollment_id);
  if (!fiche) throw ApiError.notFound('Inscription introuvable.');
  const montantNombre = Number(montant);
  if (!Number.isFinite(montantNombre) || montantNombre <= 0) {
    throw ApiError.badRequest('Le montant doit être un nombre strictement positif.', 'MONTANT_INVALIDE');
  }

  const conn = await pool.getConnection();
  let paymentId;
  try {
    await conn.beginTransaction();
    // Échéances non soldées + verrou (FOR UPDATE via le repo).
    const ouvertes = await scheduleRepo.findOuvertes(enrollment_id, conn);
    const resteTotal = ouvertes.reduce((acc, e) => acc + (Number(e.montant_du) - Number(e.montant_paye)), 0);
    if (montantNombre > resteTotal + 0.000001) {
      throw ApiError.badRequest(`Le montant dépasse le reste à payer (${resteTotal.toFixed(2)} FCFA).`, 'MONTANT_DEPASSE');
    }

    const annee = new Date().getFullYear();
    const numeroRecu = await nextReceiptNumber(annee, conn);
    paymentId = await paymentRepo.create(
      {
        enrollment_id,
        type: 'SCOLARITE',
        montant: montantNombre.toFixed(2),
        moyen,
        reference_transaction: reference_transaction?.trim() || null,
        numero_recu: numeroRecu,
        date_paiement: date_paiement || new Date(),
        created_by: actorId,
      },
      conn
    );

    // Ventilation sur les échéances.
    let restant = montantNombre;
    for (const echeance of ouvertes) {
      if (restant <= 0) break;
      const du = Number(echeance.montant_du);
      const dejaPaye = Number(echeance.montant_paye);
      const resteEcheance = du - dejaPaye;
      if (resteEcheance <= 0) continue;
      const allocation = Math.min(resteEcheance, restant);
      const nouveauPaye = Number((dejaPaye + allocation).toFixed(2));
      const statut = nouveauPaye >= du ? 'PAYE' : 'PARTIEL';
      // eslint-disable-next-line no-await-in-loop
      await scheduleRepo.appliquerRegle(echeance.id, nouveauPaye.toFixed(2), statut, conn);
      // eslint-disable-next-line no-await-in-loop
      await paymentRepo.insertAllocation({ payment_id: paymentId, schedule_id: echeance.id, montant: allocation.toFixed(2) }, conn);
      restant = Number((restant - allocation).toFixed(2));
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await audit({ userId: actorId, action: 'CREATE', entity: 'payments', entityId: paymentId, newValues: { type: 'SCOLARITE', enrollment_id, montant: montantNombre, moyen }, ipAddress: ip });
  const apres = await situation(enrollment_id);
  return { ...apres, paiement: await paymentRepo.findById(paymentId) };
}

/**
 * Annule un paiement (jamais de suppression) : motif obligatoire,
 * restitution de la ventilation, statut ANNULE, trace audit.
 */
async function annulerPaiement(paymentId, motif, actorId, ip) {
  if (!motif || !motif.trim()) {
    throw ApiError.badRequest('Un motif est obligatoire pour annuler un paiement.', 'MOTIF_REQUIS');
  }
  const payment = await paymentRepo.findById(paymentId);
  if (!payment) throw ApiError.notFound('Paiement introuvable.');
  if (payment.statut === 'ANNULE') throw ApiError.conflict('Ce paiement est déjà annulé.', 'DEJA_ANNULE');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await paymentRepo.setStatutAnnule(paymentId, motif.trim(), conn);
    if (payment.type === 'SCOLARITE') {
      await paymentRepo.reverseAllocations(paymentId, conn);
    } else if (payment.type === 'INSCRIPTION') {
      await enrollmentRepo.setStatut(payment.enrollment_id, 'EN_ATTENTE', conn);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  await audit({ userId: actorId, action: 'PAYMENT_CANCEL', entity: 'payments', entityId: paymentId, oldValues: { montant: payment.montant, type: payment.type }, newValues: { motif: motif.trim() }, ipAddress: ip });
  return { success: true };
}

const MOYENS_LIBELLE = { ESPECES: 'Espèces', FLOOZ: 'Flooz', MIXX_BY_YAS: 'Mixx By Yas' };

module.exports = {
  situation,
  payerFraisInscription,
  payerScolarite,
  annulerPaiement,
  MOYENS,
  MOYENS_LIBELLE,
  calculerStatut,
};
