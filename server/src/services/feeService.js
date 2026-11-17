// Frais de scolarité + modalités autorisées, par (année, classe).
// Écriture en transaction (frais + remplacement des modalités).
const pool = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const classRepo = require('../repositories/classRepository');
const yearRepo = require('../repositories/academicYearRepository');
const feeRepo = require('../repositories/tuitionFeeRepository');
const { log: audit } = require('../repositories/auditRepository');

const MODALITES = ['JOURNALIER', 'HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL'];

async function listerFrais(academicYearId) {
  let anneeId = academicYearId ? Number(academicYearId) : null;
  if (!anneeId) {
    const courante = await yearRepo.findCurrent();
    anneeId = courante?.id || null;
  }
  const [classes, annee] = await Promise.all([
    feeRepo.listByYear(anneeId),
    anneeId ? yearRepo.findById(anneeId) : null,
  ]);
  // Toutes les classes de l'école avec leurs frais éventuels (LEFT JOIN fait côté repo).
  const toutesClasses = await feeRepo.listFeesForYear(anneeId);
  const parClasseId = new Map(classes.map((f) => [f.class_id, f]));
  const lignes = toutesClasses.map((c) => ({
    ...parClasseId.get(c.class_id),
    ...c,
    fee_defini: Boolean(parClasseId.get(c.class_id)),
  }));
  return { annee, lignes };
}

/**
 * Enregistre les frais d'UNE classe pour l'année (montants + modalités cochées).
 */
async function enregistrerFraisClasse({ academic_year_id, class_id, frais_inscription, montant_scolarite, modalites }, actorId, ip) {
  const anneeId = academic_year_id ? Number(academic_year_id) : (await yearRepo.findCurrent())?.id;
  if (!anneeId) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
  const annee = await yearRepo.findById(anneeId);
  if (!annee) throw ApiError.badRequest('Année académique introuvable.', 'YEAR_NOT_FOUND');
  const classe = await classRepo.findById(class_id);
  if (!classe) throw ApiError.badRequest('Classe introuvable.', 'CLASSE_NOT_FOUND');

  const frais = Number(frais_inscription);
  const scolarite = Number(montant_scolarite);
  if (!(frais >= 0) || !(scolarite >= 0)) {
    throw ApiError.badRequest('Les montants doivent être des nombres positifs ou nuls.', 'MONTANTS_INVALIDES');
  }
  const mods = (modalites || []).filter((m) => MODALITES.includes(m));
  if (mods.length === 0) {
    throw ApiError.badRequest('Cochez au moins une modalité de paiement.', 'MODALITES_REQUISES');
  }

  const conn = await pool.getConnection();
  let feeId;
  try {
    await conn.beginTransaction();
    feeId = await feeRepo.upsertFee(conn, { academic_year_id: anneeId, class_id, frais_inscription: frais.toFixed(2), montant_scolarite: scolarite.toFixed(2) });
    await feeRepo.replaceModalities(conn, feeId, mods);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await audit({ userId: actorId, action: 'UPSERT', entity: 'tuition_fees', entityId: feeId, newValues: { class_id, frais_inscription: frais, montant_scolarite: scolarite, modalites: mods }, ipAddress: ip });
  return feeRepo.findByYearAndClass(anneeId, class_id);
}

/**
 * Enregistre les frais de PLUSIEURS classes en une opération (mêmes
 * montants + mêmes modalités). Tout ou rien.
 */
async function enregistrerFraisGroupe({ academic_year_id, class_ids, frais_inscription, montant_scolarite, modalites }, actorId, ip) {
  const ids = [...new Set((class_ids || []).map(Number))].filter(Boolean);
  if (ids.length === 0) throw ApiError.badRequest('Sélectionnez au moins une classe.', 'CLASSES_REQUISES');
  for (const id of ids) {
    const classe = await classRepo.findById(id);
    if (!classe) throw ApiError.badRequest(`Classe introuvable (id ${id}).`, 'CLASSE_NOT_FOUND');
  }
  const resultats = [];
  for (const class_id of ids) {
    // Réutilise la validation unitaire (sans re-vérifier l'année à chaque tour).
    // eslint-disable-next-line no-await-in-loop
    resultats.push(await enregistrerFraisClasse({ academic_year_id, class_id, frais_inscription, montant_scolarite, modalites }, actorId, ip));
  }
  return resultats;
}

/** Frais d'une classe pour l'année courante (formulaire d'inscription). */
async function fraisClassePourInscription(classId, academicYearId = null) {
  const anneeId = academicYearId ? Number(academicYearId) : (await yearRepo.findCurrent())?.id;
  if (!anneeId) return null;
  return feeRepo.findByYearAndClass(anneeId, classId);
}

/** Toutes les classes avec frais pour le formulaire d'inscription (cascade). */
async function classesPourInscription(academicYearId = null) {
  const anneeId = academicYearId ? Number(academicYearId) : (await yearRepo.findCurrent())?.id;
  if (!anneeId) return { annee: null, lignes: [] };
  const annee = await yearRepo.findById(anneeId);
  const lignes = (await feeRepo.listFeesForYear(anneeId)).map((l) => ({
    ...l,
    frais_defini: l.frais_inscription != null,
  }));
  return { annee, lignes };
}

module.exports = { listerFrais, enregistrerFraisClasse, enregistrerFraisGroupe, fraisClassePourInscription, classesPourInscription, MODALITES };
