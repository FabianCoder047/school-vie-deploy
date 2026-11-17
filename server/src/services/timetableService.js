// Emploi du temps : créneaux de 55 min (ou multiples), fin calculée,
// détection des chevauchements (même alias / même professeur / même salle).
const { ApiError } = require('../utils/ApiError');
const yearRepo = require('../repositories/academicYearRepository');
const aliasRepo = require('../repositories/classAliasRepository');
const settingsRepo = require('../repositories/settingsRepository');
const assignRepo = require('../repositories/teacherAssignmentRepository');
const timetableRepo = require('../repositories/timetableRepository');
const { heureEnMinutes, minutesEnHeure, plagesSeChevauchent } = require('../utils/timeUtils');
const { log: audit } = require('../repositories/auditRepository');
const pool = require('../config/db');

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Durée d'une heure de cours depuis school_settings (fallback 55). */
async function dureeHeure() {
  try {
    const s = await settingsRepo.get();
    return Number(s?.duree_heure_minutes) || 55;
  } catch {
    return 55;
  }
}

async function anneeCouranteOu(anneeId) {
  if (anneeId) {
    const a = await yearRepo.findById(Number(anneeId));
    return a?.id || null;
  }
  const courante = await yearRepo.findCurrent();
  return courante?.id || null;
}

async function listerCreneaux({ class_alias_id, academic_year_id, teacher_id }) {
  const anneeId = await anneeCouranteOu(academic_year_id);
  if (teacher_id) return timetableRepo.listByTeacher(anneeId, Number(teacher_id));
  if (class_alias_id) return timetableRepo.listByAlias(anneeId, Number(class_alias_id));
  return [];
}

async function affectationsPourAlias({ class_alias_id, academic_year_id }) {
  const anneeId = await anneeCouranteOu(academic_year_id);
  if (!class_alias_id) return [];
  return timetableRepo.assignmentsForAlias(anneeId, Number(class_alias_id));
}

/** Calcule la fin de créneau + contrôle des chevauchements (alias/prof/salle). */
async function controlerConflits({ academicYearId, data, excludeId = null }) {
  const duree = await dureeHeure();
  const nbHeures = Number(data.nb_heures);
  if (!Number.isInteger(nbHeures) || nbHeures < 1 || nbHeures > 8) {
    throw ApiError.badRequest('Le nombre d’heures par créneau doit être un entier entre 1 et 8.', 'NB_HEURES_INVALIDE');
  }
  const debut = heureEnMinutes(data.heure_debut);
  const fin = debut + nbHeures * duree;
  if (fin >= 24 * 60) {
    throw ApiError.badRequest('Le créneau dépasserait minuit.', 'HEURE_FIN_INVALIDE');
  }
  const heure_fin = minutesEnHeure(fin);

  // Professeur du créneau via l'affectation (contrôles croisés côté service).
  const affectation = await assignRepo.findById(Number(data.teacher_assignment_id));
  if (!affectation) throw ApiError.badRequest('Affectation de professeur introuvable.', 'ASSIGNATION_NOT_FOUND');
  const professeurId = affectation.teacher_id;

  const conflits = await timetableRepo.findConflits({
    academicYearId,
    jourSemaine: Number(data.jour_semaine),
    classAliasId: Number(data.class_alias_id),
    teacherId: professeurId,
    salle: data.salle?.trim() || null,
    excludeId,
  });

  for (const c of conflits) {
    if (!plagesSeChevauchent(data.heure_debut, heure_fin, c.heure_debut, c.heure_fin)) continue;
    if (c.class_alias_id === Number(data.class_alias_id)) {
      throw ApiError.conflict(
        `Chevauchement dans la même classe/alias : ${c.matiere_nom} avec ${c.prof_prenom} ${c.prof_nom} est déjà planifié le ${JOURS[c.jour_semaine - 1]} de ${String(c.heure_debut).slice(0, 5)} à ${String(c.heure_fin).slice(0, 5)}.`,
        'CRENEAU_ALIAS'
      );
    }
    if (c.teacher_id === professeurId) {
      throw ApiError.conflict(
        `Le professeur ${c.prof_prenom} ${c.prof_nom} est déjà occupé le ${JOURS[c.jour_semaine - 1]} de ${String(c.heure_debut).slice(0, 5)} à ${String(c.heure_fin).slice(0, 5)} (${c.matiere_nom}).`,
        'CRENEAU_PROF'
      );
    }
    if (data.salle && c.salle && data.salle.trim().toLowerCase() === String(c.salle).toLowerCase()) {
      throw ApiError.conflict(
        `La salle « ${c.salle} » est déjà occupée le ${JOURS[c.jour_semaine - 1]} de ${String(c.heure_debut).slice(0, 5)} à ${String(c.heure_fin).slice(0, 5)}.`,
        'CRENEAU_SALLE'
      );
    }
  }
  return { heure_fin, nbHeures };
}

async function assertAssignationCoherente(anneeId, teacherAssignmentId, classAliasId) {
  const [[assign]] = await pool.query(
    'SELECT class_alias_id, academic_year_id FROM teacher_assignments WHERE id = ?',
    [teacherAssignmentId]
  );
  if (!assign || assign.class_alias_id !== Number(classAliasId) || assign.academic_year_id !== Number(anneeId)) {
    throw ApiError.badRequest('Cette affectation ne correspond pas à l’alias et l’année choisis.', 'ASSIGNATION_MISMATCH');
  }
}

async function creerCreneau(data, actorId, ip) {
  const alias = await aliasRepo.findById(data.class_alias_id);
  if (!alias) throw ApiError.badRequest('Alias introuvable.', 'ALIAS_NOT_FOUND');
  const anneeId = await anneeCouranteOu(data.academic_year_id);
  if (!anneeId) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
  await assertAssignationCoherente(anneeId, data.teacher_assignment_id, data.class_alias_id);

  const { heure_fin, nbHeures } = await controlerConflits({ academicYearId: anneeId, data });
  const creneau = await timetableRepo.create({ ...data, academic_year_id: anneeId, nb_heures: nbHeures, heure_fin, salle: data.salle?.trim() || null });
  await audit({ userId: actorId, action: 'CREATE', entity: 'timetable_slots', entityId: creneau.id, newValues: data, ipAddress: ip });
  return creneau;
}

async function modifierCreneau(id, data, actorId, ip) {
  const existant = await timetableRepo.findById(id);
  if (!existant) throw ApiError.notFound('Créneau introuvable.');
  const anneeId = existant.academic_year_id;
  await assertAssignationCoherente(anneeId, data.teacher_assignment_id, data.class_alias_id);

  const { heure_fin, nbHeures } = await controlerConflits({ academicYearId: anneeId, data, excludeId: id });
  const creneau = await timetableRepo.update(id, { ...data, nb_heures: nbHeures, heure_fin, salle: data.salle?.trim() || null });
  await audit({ userId: actorId, action: 'UPDATE', entity: 'timetable_slots', entityId: id, oldValues: existant, newValues: data, ipAddress: ip });
  return creneau;
}

async function supprimerCreneau(id, actorId, ip) {
  const existant = await timetableRepo.findById(id);
  if (!existant) throw ApiError.notFound('Créneau introuvable.');
  await timetableRepo.remove(id);
  await audit({ userId: actorId, action: 'DELETE', entity: 'timetable_slots', entityId: id, oldValues: existant, ipAddress: ip });
  return { success: true };
}

module.exports = { listerCreneaux, affectationsPourAlias, creerCreneau, modifierCreneau, supprimerCreneau, dureeHeure };
