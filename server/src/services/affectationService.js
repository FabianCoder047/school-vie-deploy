// Affectations : matière → classes (+ coefficients) et professeur →
// (matière de classe × alias × année). Règles métier du §6 du cahier.
const { ApiError } = require('../utils/ApiError');
const aliasRepo = require('../repositories/classAliasRepository');
const classRepo = require('../repositories/classRepository');
const subjectRepo = require('../repositories/subjectRepository');
const csRepo = require('../repositories/classSubjectRepository');
const assignRepo = require('../repositories/teacherAssignmentRepository');
const yearRepo = require('../repositories/academicYearRepository');
const userMgmtRepo = require('../repositories/userManagementRepository');
const { log: audit } = require('../repositories/auditRepository');

/* ===== ALIAS DE CLASSE ===== */
async function listerAlias(query) { return aliasRepo.list(query); }
/**
 * Alias d'une classe pour les sélecteurs. Si le Directeur n'a rien défini,
 * la classe fonctionne comme un groupe unique : on retourne (en le créant
 * si besoin) un alias implicite portant le nom de la classe.
 */
async function listerAliasDeClasse(classId) {
  const lignes = await aliasRepo.listByClasse(Number(classId));
  if (lignes.length > 0) return lignes;
  const classe = await classRepo.findById(Number(classId));
  if (!classe) return [];
  return [await aliasRepo.findOuCreerDefaut(Number(classId), classe.nom)];
}

async function creerAlias(data, actorId, ip) {
  const classe = await classRepo.findById(data.class_id);
  if (!classe) throw ApiError.badRequest('Classe introuvable.', 'CLASSE_NOT_FOUND');
  try {
    const alias = await aliasRepo.create(data);
    await audit({ userId: actorId, action: 'CREATE', entity: 'class_aliases', entityId: alias.id, newValues: data, ipAddress: ip });
    return alias;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw ApiError.conflict('Un alias avec ce nom existe déjà pour cette classe.', 'ALIAS_DOUBLON');
    throw err;
  }
}

async function modifierAlias(id, data, actorId, ip) {
  const existant = await aliasRepo.findById(id);
  if (!existant) throw ApiError.notFound('Alias introuvable.');
  try {
    const alias = await aliasRepo.update(id, data);
    await audit({ userId: actorId, action: 'UPDATE', entity: 'class_aliases', entityId: id, oldValues: existant, newValues: data, ipAddress: ip });
    return alias;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw ApiError.conflict('Un alias avec ce nom existe déjà pour cette classe.', 'ALIAS_DOUBLON');
    throw err;
  }
}

async function supprimerAlias(id, actorId, ip) {
  const existant = await aliasRepo.findById(id);
  if (!existant) throw ApiError.notFound('Alias introuvable.');
  const usage = await aliasRepo.compterUsages(id);
  if (usage.total > 0) {
    const details = [];
    if (usage.inscriptions) details.push(`${usage.inscriptions} inscription(s)`);
    if (usage.affectations) details.push(`${usage.affectations} affectation(s) de professeur`);
    if (usage.creneaux) details.push(`${usage.creneaux} créneau(x) d'emploi du temps`);
    throw ApiError.conflict(`Impossible de supprimer l’alias « ${existant.nom} » : utilisé (${details.join(', ')}).`, 'ENTITY_IN_USE');
  }
  await aliasRepo.remove(id);
  await audit({ userId: actorId, action: 'DELETE', entity: 'class_aliases', entityId: id, oldValues: existant, ipAddress: ip });
  return { success: true };
}

/* ===== AFFECTATION MATIÈRE → CLASSES (+ COEFFICIENTS) ===== */
async function listerAffectations(filters) { return csRepo.listDetailed(filters); }

/**
 * Affecte (ou met à jour le coefficient d') une matière dans plusieurs
 * classes en une seule opération. Validation complète AVANT écriture.
 */
async function affecterMatiereAuxClasses(subjectId, affectations, actorId, ip) {
  const matiere = await subjectRepo.findById(subjectId);
  if (!matiere) throw ApiError.badRequest('Matière introuvable.', 'SUBJECT_NOT_FOUND');
  if (!Array.isArray(affectations) || affectations.length === 0) {
    throw ApiError.badRequest('Sélectionnez au moins une classe.', 'CLASSES_REQUISES');
  }
  const ids = [...new Set(affectations.map((a) => a.class_id))];
  for (const id of ids) {
    const classe = await classRepo.findById(id);
    if (!classe) throw ApiError.badRequest(`Classe introuvable (id ${id}).`, 'CLASSE_NOT_FOUND');
  }
  for (const a of affectations) {
    if (!(Number(a.coefficient) > 0)) {
      throw ApiError.badRequest('Chaque coefficient doit être un nombre strictement positif.', 'COEFFICIENT_INVALIDE');
    }
  }
  // Dédoublonne en gardant la dernière valeur saisie pour une classe.
  const parClasse = new Map();
  for (const a of affectations) parClasse.set(Number(a.class_id), Number(a.coefficient));
  const nettoyees = [...parClasse.entries()].map(([class_id, coefficient]) => ({ class_id, coefficient }));

  await csRepo.upsertBulk(subjectId, nettoyees);
  await audit({
    userId: actorId,
    action: 'UPSERT',
    entity: 'class_subjects',
    entityId: subjectId,
    newValues: { matiere: matiere.nom, affectations: nettoyees },
    ipAddress: ip,
  });
  return csRepo.listDetailed({ subject_id: subjectId });
}

async function retirerAffectationMatiere(id, actorId, ip) {
  const existant = await csRepo.findById(id);
  if (!existant) throw ApiError.notFound('Affectation introuvable.');
  const nbProfs = await csRepo.compterAffectationsProfesseur(id);
  if (nbProfs > 0) {
    throw ApiError.conflict(`Impossible de retirer ${existant.matiere_nom} en ${existant.classe_nom} : ${nbProfs} professeur(s) y sont affectés. Retirez d'abord ces affectations.`, 'ENTITY_IN_USE');
  }
  await csRepo.remove(id);
  await audit({ userId: actorId, action: 'DELETE', entity: 'class_subjects', entityId: id, oldValues: existant, ipAddress: ip });
  return { success: true };
}

/* ===== AFFECTATION PROFESSEUR → (MATIÈRE × ALIAS × ANNÉE) ===== */
async function listerAffectationsProfesseur(filters) { return assignRepo.listDetailed(filters); }

/**
 * Affecte un professeur à des couples (class_subject, class_alias) pour une
 * année. Validation complète de TOUTES les lignes avant écriture (tout ou rien).
 */
async function affecterProfesseur({ academic_year_id, teacher_id, affectations }, actorId, ip) {
  // Année cible : celle demandée, sinon l'année courante.
  let anneeId = academic_year_id ? Number(academic_year_id) : null;
  if (!anneeId) {
    const courante = await yearRepo.findCurrent();
    if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
    anneeId = courante.id;
  } else {
    const annee = await yearRepo.findById(anneeId);
    if (!annee) throw ApiError.badRequest('Année académique introuvable.', 'YEAR_NOT_FOUND');
  }

  const prof = await userMgmtRepo.findById(teacher_id);
  if (!prof || prof.role !== 'PROFESSEUR') {
    throw ApiError.badRequest('Sélectionnez un professeur.', 'PROF_INVALIDE');
  }
  if (!prof.is_active) {
    throw ApiError.badRequest('Ce professeur est désactivé.', 'PROF_INACTIF');
  }
  if (!Array.isArray(affectations) || affectations.length === 0) {
    throw ApiError.badRequest('Sélectionnez au moins une matière et un alias.', 'AFFECTATIONS_REQUISES');
  }

  // Passe 1 : validation complète.
  const lignes = [];
  const clesVues = new Set();
  for (const ligne of affectations) {
    const csId = Number(ligne.class_subject_id);
    const aliasId = Number(ligne.class_alias_id);
    const cle = `${csId}:${aliasId}`;
    if (clesVues.has(cle)) continue; // dédoublonne la sélection
    clesVues.add(cle);

    const appartient = await assignRepo.aliasAppartientALaClasseMatiere(csId, aliasId);
    if (!appartient) {
      throw ApiError.badRequest('La matière n’est pas affectée à la classe parente de cet alias. Affectez d’abord la matière à la classe.', 'ALIAS_CLASS_MISMATCH');
    }
    const conflit = await assignRepo.findConflit(anneeId, csId, aliasId);
    if (conflit) {
      throw ApiError.conflict(`Un professeur est déjà affecté à cette matière pour cet alias sur cette année (${conflit.prenom} ${conflit.nom}).`, 'ASSIGNATION_CONFLIT');
    }
    lignes.push({ academic_year_id: anneeId, teacher_id: prof.id, class_subject_id: csId, class_alias_id: aliasId });
  }

  // Passe 2 : écriture.
  const creees = [];
  for (const ligne of lignes) {
    const id = await assignRepo.create(ligne);
    creees.push(id);
    await audit({ userId: actorId, action: 'CREATE', entity: 'teacher_assignments', entityId: id, newValues: ligne, ipAddress: ip });
  }
  return listerAffectationsProfesseur({ academic_year_id: anneeId, teacher_id: prof.id });
}

async function retirerAffectationProfesseur(id, actorId, ip) {
  const existant = await assignRepo.findById(id);
  if (!existant) throw ApiError.notFound('Affectation de professeur introuvable.');
  const nbCreneaux = await assignRepo.countCreneaux(id);
  if (nbCreneaux > 0) {
    throw ApiError.conflict(`Impossible de retirer cette affectation : ${nbCreneaux} créneau(x) d’emploi du temps y sont liés.`, 'ENTITY_IN_USE');
  }
  await assignRepo.remove(id);
  await audit({ userId: actorId, action: 'DELETE', entity: 'teacher_assignments', entityId: id, oldValues: existant, ipAddress: ip });
  return { success: true };
}

module.exports = {
  listerAlias, listerAliasDeClasse, creerAlias, modifierAlias, supprimerAlias,
  listerAffectations, affecterMatiereAuxClasses, retirerAffectationMatiere,
  listerAffectationsProfesseur, affecterProfesseur, retirerAffectationProfesseur,
};
