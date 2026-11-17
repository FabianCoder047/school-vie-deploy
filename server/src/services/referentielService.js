// Référentiels : cycles, classes, matières, années académiques.
// Suppression refusée (409) si l'élément est utilisé ailleurs, avec détail.
const { ApiError } = require('../utils/ApiError');
const cycleRepo = require('../repositories/cycleRepository');
const classRepo = require('../repositories/classRepository');
const subjectRepo = require('../repositories/subjectRepository');
const yearRepo = require('../repositories/academicYearRepository');
const { log: audit } = require('../repositories/auditRepository');

/* ===== CYCLES ===== */
async function listerCycles(query) { return cycleRepo.list(query); }

async function creerCycle(data, actorId, ip) {
  const cycle = await cycleRepo.create(data);
  await audit({ userId: actorId, action: 'CREATE', entity: 'cycles', entityId: cycle.id, newValues: data, ipAddress: ip });
  return cycle;
}

async function modifierCycle(id, data, actorId, ip) {
  const existant = await cycleRepo.findById(id);
  if (!existant) throw ApiError.notFound('Cycle introuvable.');
  const cycle = await cycleRepo.update(id, data);
  await audit({ userId: actorId, action: 'UPDATE', entity: 'cycles', entityId: id, oldValues: existant, newValues: data, ipAddress: ip });
  return cycle;
}

async function supprimerCycle(id, actorId, ip) {
  const existant = await cycleRepo.findById(id);
  if (!existant) throw ApiError.notFound('Cycle introuvable.');
  const nbClasses = await cycleRepo.compterClasses(id);
  if (nbClasses > 0) {
    throw ApiError.conflict(`Impossible de supprimer « ${existant.nom} » : ${nbClasses} classe(s) y sont rattachées. Supprimez d'abord ces classes.`, 'ENTITY_IN_USE');
  }
  await cycleRepo.remove(id);
  await audit({ userId: actorId, action: 'DELETE', entity: 'cycles', entityId: id, oldValues: existant, ipAddress: ip });
  return { success: true };
}

/* ===== CLASSES ===== */
async function listerClasses(query) { return classRepo.list(query); }
async function listerToutesLesClasses() { return classRepo.listAll(); }

async function creerClasse(data, actorId, ip) {
  const cycle = await cycleRepo.findById(data.cycle_id);
  if (!cycle) throw ApiError.badRequest('Cycle introuvable.', 'CYCLE_NOT_FOUND');
  const classe = await classRepo.create(data);
  await audit({ userId: actorId, action: 'CREATE', entity: 'classes', entityId: classe.id, newValues: data, ipAddress: ip });
  return classe;
}

async function modifierClasse(id, data, actorId, ip) {
  const existant = await classRepo.findById(id);
  if (!existant) throw ApiError.notFound('Classe introuvable.');
  const cycle = await cycleRepo.findById(data.cycle_id);
  if (!cycle) throw ApiError.badRequest('Cycle introuvable.', 'CYCLE_NOT_FOUND');
  const classe = await classRepo.update(id, data);
  await audit({ userId: actorId, action: 'UPDATE', entity: 'classes', entityId: id, oldValues: existant, newValues: data, ipAddress: ip });
  return classe;
}

async function supprimerClasse(id, actorId, ip) {
  const existant = await classRepo.findById(id);
  if (!existant) throw ApiError.notFound('Classe introuvable.');
  const usage = await classRepo.compterUsages(id);
  if (usage.total > 0) {
    const details = [];
    if (usage.alias) details.push(`${usage.alias} alias`);
    if (usage.affectations) details.push(`${usage.affectations} affectation(s) de matière`);
    if (usage.frais) details.push(`${usage.frais} barème(s) de frais`);
    if (usage.inscriptions) details.push(`${usage.inscriptions} inscription(s)`);
    throw ApiError.conflict(`Impossible de supprimer la classe « ${existant.nom} » : elle est utilisée (${details.join(', ')}).`, 'ENTITY_IN_USE');
  }
  await classRepo.remove(id);
  await audit({ userId: actorId, action: 'DELETE', entity: 'classes', entityId: id, oldValues: existant, ipAddress: ip });
  return { success: true };
}

/* ===== MATIÈRES ===== */
async function listerMatieres(query) { return subjectRepo.list(query); }
async function listerToutesLesMatieres() { return subjectRepo.listAll(); }

async function creerMatiere(data, actorId, ip) {
  const matiere = await subjectRepo.create(data);
  await audit({ userId: actorId, action: 'CREATE', entity: 'subjects', entityId: matiere.id, newValues: data, ipAddress: ip });
  return matiere;
}

async function modifierMatiere(id, data, actorId, ip) {
  const existant = await subjectRepo.findById(id);
  if (!existant) throw ApiError.notFound('Matière introuvable.');
  const matiere = await subjectRepo.update(id, data);
  await audit({ userId: actorId, action: 'UPDATE', entity: 'subjects', entityId: id, oldValues: existant, newValues: data, ipAddress: ip });
  return matiere;
}

async function supprimerMatiere(id, actorId, ip) {
  const existant = await subjectRepo.findById(id);
  if (!existant) throw ApiError.notFound('Matière introuvable.');
  const nb = await subjectRepo.compterAffectations(id);
  if (nb > 0) {
    throw ApiError.conflict(`Impossible de supprimer « ${existant.nom} » : ${nb} affectation(s) classe↔matière existent. Retirez-les d'abord.`, 'ENTITY_IN_USE');
  }
  await subjectRepo.remove(id);
  await audit({ userId: actorId, action: 'DELETE', entity: 'subjects', entityId: id, oldValues: existant, ipAddress: ip });
  return { success: true };
}

/* ===== ANNÉES ACADÉMIQUES ===== */
async function listerAnnees(query) { return yearRepo.list(query); }
async function listerToutesLesAnnees() { return yearRepo.listAll(); }
async function anneeCourante() { return yearRepo.findCurrent(); }

async function creerAnnee(data, actorId, ip) {
  if (String(data.date_fin) <= String(data.date_debut)) {
    throw ApiError.badRequest('La date de fin doit être postérieure à la date de début.', 'YEAR_DATES_INVALID');
  }
  const annee = await yearRepo.create(data);
  await audit({ userId: actorId, action: 'CREATE', entity: 'academic_years', entityId: annee.id, newValues: data, ipAddress: ip });
  return annee;
}

async function modifierAnnee(id, data, actorId, ip) {
  const existant = await yearRepo.findById(id);
  if (!existant) throw ApiError.notFound('Année académique introuvable.');
  if (String(data.date_fin) <= String(data.date_debut)) {
    throw ApiError.badRequest('La date de fin doit être postérieure à la date de début.', 'YEAR_DATES_INVALID');
  }
  const annee = await yearRepo.update(id, data);
  await audit({ userId: actorId, action: 'UPDATE', entity: 'academic_years', entityId: id, oldValues: existant, newValues: data, ipAddress: ip });
  return annee;
}

async function definirAnneeCourante(id, actorId, ip) {
  const existant = await yearRepo.findById(id);
  if (!existant) throw ApiError.notFound('Année académique introuvable.');
  const annee = await yearRepo.setCurrent(id);
  await audit({ userId: actorId, action: 'SET_CURRENT_YEAR', entity: 'academic_years', entityId: id, newValues: { libelle: existant.libelle }, ipAddress: ip });
  return annee;
}

async function supprimerAnnee(id, actorId, ip) {
  const existant = await yearRepo.findById(id);
  if (!existant) throw ApiError.notFound('Année académique introuvable.');
  if (existant.is_current) {
    throw ApiError.conflict('Impossible de supprimer l’année courante. Définissez d’abord une autre année courante.', 'ENTITY_IN_USE');
  }
  const usage = await yearRepo.compterUsages(id);
  if (usage.total > 0) {
    const details = [];
    if (usage.inscriptions) details.push(`${usage.inscriptions} inscription(s)`);
    if (usage.affectations) details.push(`${usage.affectations} affectation(s) de professeur`);
    if (usage.frais) details.push(`${usage.frais} barème(s) de frais`);
    if (usage.creneaux) details.push(`${usage.creneaux} créneau(x)`);
    if (usage.periodes) details.push(`${usage.periodes} période(s) d'évaluation`);
    throw ApiError.conflict(`Impossible de supprimer l’année « ${existant.libelle} » : elle est utilisée (${details.join(', ')}).`, 'ENTITY_IN_USE');
  }
  await yearRepo.remove(id);
  await audit({ userId: actorId, action: 'DELETE', entity: 'academic_years', entityId: id, oldValues: existant, ipAddress: ip });
  return { success: true };
}

module.exports = {
  listerCycles, creerCycle, modifierCycle, supprimerCycle,
  listerClasses, listerToutesLesClasses, creerClasse, modifierClasse, supprimerClasse,
  listerMatieres, listerToutesLesMatieres, creerMatiere, modifierMatiere, supprimerMatiere,
  listerAnnees, listerToutesLesAnnees, anneeCourante, creerAnnee, modifierAnnee, definirAnneeCourante, supprimerAnnee,
};
