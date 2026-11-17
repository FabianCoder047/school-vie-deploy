// Périodes d'évaluation + fenêtre de saisie des notes (DIRECTEUR).
const { ApiError } = require('../utils/ApiError');
const yearRepo = require('../repositories/academicYearRepository');
const periodRepo = require('../repositories/evaluationPeriodRepository');
const { log: audit } = require('../repositories/auditRepository');

async function listerPeriodes(academicYearId) {
  let anneeId = academicYearId ? Number(academicYearId) : null;
  if (!anneeId) {
    const courante = await yearRepo.findCurrent();
    anneeId = courante?.id || null;
  }
  const periodes = anneeId ? await periodRepo.listByYear(anneeId) : [];
  const annee = anneeId ? await yearRepo.findById(anneeId) : null;
  return { annee, periodes: periodes.map((p) => ({ ...p, fenetre: periodRepo.fenetreSaisie(p) })) };
}

async function creerPeriode(data, actorId, ip) {
  const anneeId = data.academic_year_id ? Number(data.academic_year_id) : (await yearRepo.findCurrent())?.id;
  if (!anneeId) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
  if (String(data.date_fin) <= String(data.date_debut)) {
    throw ApiError.badRequest('La date de fin de période doit être postérieure au début.', 'PERIODE_DATES');
  }
  if (data.saisie_debut && data.saisie_fin && new Date(data.saisie_fin) <= new Date(data.saisie_debut)) {
    throw ApiError.badRequest('La fin de la fenêtre de saisie doit être postérieure au début.', 'FENETRE_DATES');
  }
  try {
    const periode = await periodRepo.create({ ...data, academic_year_id: anneeId });
    await audit({ userId: actorId, action: 'CREATE', entity: 'evaluation_periods', entityId: periode.id, newValues: data, ipAddress: ip });
    return { ...periode, fenetre: periodRepo.fenetreSaisie(periode) };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('Une période avec ce numéro existe déjà pour cette année.', 'PERIODE_DOUBLON');
    }
    throw err;
  }
}

async function modifierPeriode(id, data, actorId, ip) {
  const existant = await periodRepo.findById(id);
  if (!existant) throw ApiError.notFound('Période introuvable.');
  if (String(data.date_fin) <= String(data.date_debut)) {
    throw ApiError.badRequest('La date de fin de période doit être postérieure au début.', 'PERIODE_DATES');
  }
  if (data.saisie_debut && data.saisie_fin && new Date(data.saisie_fin) <= new Date(data.saisie_debut)) {
    throw ApiError.badRequest('La fin de la fenêtre de saisie doit être postérieure au début.', 'FENETRE_DATES');
  }
  try {
    const periode = await periodRepo.update(id, data);
    await audit({ userId: actorId, action: 'UPDATE', entity: 'evaluation_periods', entityId: id, oldValues: existant, newValues: data, ipAddress: ip });
    return { ...periode, fenetre: periodRepo.fenetreSaisie(periode) };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('Une période avec ce numéro existe déjà pour cette année.', 'PERIODE_DOUBLON');
    }
    throw err;
  }
}

async function supprimerPeriode(id, actorId, ip) {
  const existant = await periodRepo.findById(id);
  if (!existant) throw ApiError.notFound('Période introuvable.');
  const nbNotes = await periodRepo.compterNotes(id);
  if (nbNotes > 0) {
    throw ApiError.conflict(`Impossible de supprimer « ${existant.libelle} » : ${nbNotes} note(s) y sont saisies.`, 'ENTITY_IN_USE');
  }
  await periodRepo.remove(id);
  await audit({ userId: actorId, action: 'DELETE', entity: 'evaluation_periods', entityId: id, oldValues: existant, ipAddress: ip });
  return { success: true };
}

/** Vérifie que la saisie de notes est ouverte pour cette période (sinon erreur explicite). */
async function assertSaisieOuverte(evaluationPeriodId) {
  const periode = await periodRepo.findById(evaluationPeriodId);
  if (!periode) throw ApiError.notFound('Période introuvable.');
  const fenetre = periodRepo.fenetreSaisie(periode);
  if (!fenetre.ouverte) {
    throw ApiError.forbidden(`La saisie des notes est fermée. ${fenetre.motif}`, 'SAISIE_FERMEE');
  }
  return periode;
}

module.exports = { listerPeriodes, creerPeriode, modifierPeriode, supprimerPeriode, assertSaisieOuverte };
