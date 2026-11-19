// Justification des absences — logique partagée parent / professeur / directeur.
// - Le parent renseigne un motif (envoyé à l'école, utilisable en conseil de discipline).
// - Le professeur marque une absence « justifiée » pendant/après l'appel (note optionnelle).
// - Le directeur consulte la fiche absences d'un élève.
const pool = require('../config/db');
const attendanceRepo = require('../repositories/attendanceRepository');
const { ApiError } = require('../utils/ApiError');

/** Vérifie que l'enregistrement de présence appartient à un enfant du parent. */
async function assertRecordEnfant(userId, recordId) {
  const [[row]] = await pool.query(
    `SELECT ar.id, ar.statut, ar.justification, ar.justification_statut, ar.justification_par, ar.justification_at,
            e.id AS enrollment_id, e.academic_year_id, e.class_alias_id, g.user_id AS parent_user_id
       FROM attendance_records ar
       JOIN enrollments e ON e.id = ar.enrollment_id
       JOIN students s ON s.id = e.student_id
       JOIN guardians g ON g.id = s.guardian_id
      WHERE ar.id = ?`,
    [recordId]
  );
  if (!row) throw ApiError.notFound('Absence introuvable.', 'ABSENCE_INTROUVABLE');
  if (Number(row.parent_user_id) !== Number(userId)) {
    throw ApiError.forbidden('Cette absence ne concerne pas vos enfants.', 'ABSENCE_NON_PARENT');
  }
  return row;
}

/** Résumé : absences (totales/justifiées/non) + retards. */
function resumeFromRecords(records) {
  const summary = { absences: 0, absencesJustifiees: 0, absencesNonJustifiees: 0, retards: 0, retardMinutes: 0 };
  for (const r of records) {
    if (r.statut === 'ABSENT') {
      summary.absences += 1;
      if (r.justification_statut === 'JUSTIFIEE') summary.absencesJustifiees += 1;
      else summary.absencesNonJustifiees += 1;
    } else if (r.statut === 'RETARD') {
      summary.retards += 1;
      summary.retardMinutes += Number(r.minutes_retard || 0);
    }
  }
  return summary;
}

/** Détail des absences/retards d'un élève (+ infos élève). */
async function absencesEleve(enrollmentId) {
  const [[eleve]] = await pool.query(
    `SELECT e.id AS enrollment_id, e.academic_year_id, e.statut,
            s.matricule, s.nom, s.prenom, s.date_naissance, s.sexe, s.lieu_naissance,
            a.nom AS alias_nom, cl.nom AS classe_nom, cy.nom AS cycle_nom
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_aliases a ON a.id = e.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE e.id = ?`,
    [enrollmentId]
  );
  if (!eleve) throw ApiError.notFound('Élève introuvable.', 'ELEVE_INTROUVABLE');
  const absences = await attendanceRepo.listAbsencesEleve(enrollmentId);
  return { eleve, absences, summary: resumeFromRecords(absences) };
}

/** Le professeur connecté enseigne-t-il dans l'alias de l'élève (année courante) ? */
async function assertProfesseurDeLEleve(teacherId, enrollmentId, academicYearId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
       FROM enrollments e
       JOIN teacher_assignments ta ON ta.class_alias_id = e.class_alias_id AND ta.academic_year_id = e.academic_year_id
      WHERE e.id = ? AND ta.teacher_id = ? AND e.academic_year_id = ?
      LIMIT 1`,
    [enrollmentId, teacherId, academicYearId]
  );
  if (!row) throw ApiError.forbidden('Cet élève n’appartient pas à l’une de vos classes.', 'ELEVE_HORS_PROFESSEUR');
}

/** Le parent renseigne/modifie le motif d'une absence de son enfant. */
async function justifierMotif(userId, recordId, motif) {
  const note = String(motif ?? '').trim();
  if (note.length < 3) throw ApiError.badRequest('Le motif doit contenir au moins 3 caractères.', 'MOTIF_TROP_COURT');
  if (note.length > 500) throw ApiError.badRequest('Le motif est trop long (500 caractères maximum).', 'MOTIF_TROP_LONG');
  const record = await assertRecordEnfant(userId, recordId);
  if (!['ABSENT', 'RETARD'].includes(record.statut)) {
    throw ApiError.badRequest('Seules les absences et les retards peuvent être justifiés.', 'STATUT_NON_JUSTIFIABLE');
  }
  await pool.query(
    `UPDATE attendance_records
        SET justification_statut = 'JUSTIFIEE', justification_par = 'PARENT', justification_at = NOW(), justification = ?
      WHERE id = ?`,
    [note, recordId]
  );
  return { ok: true };
}

/** Le parent retire le motif qu'il avait envoyé (pas celui saisi par le professeur). */
async function retirerMotif(userId, recordId) {
  const record = await assertRecordEnfant(userId, recordId);
  if (record.justification_par === 'PROFESSEUR') {
    throw ApiError.forbidden('Cette absence a été justifiée par le professeur : seul le professeur peut modifier la justification.', 'JUSTIFIEE_PAR_PROFESSEUR');
  }
  await pool.query(
    `UPDATE attendance_records
        SET justification_statut = 'NON_JUSTIFIEE', justification_par = NULL, justification_at = NULL, justification = NULL
      WHERE id = ?`,
    [recordId]
  );
  return { ok: true };
}

module.exports = { absencesEleve, assertProfesseurDeLEleve, justifierMotif, retirerMotif, resumeFromRecords };
