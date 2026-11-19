// Séances d'appel (unique par professeur × date × heure) + présences par élève.
const pool = require('../config/db');

/** Séance du jour (assignment × date × heure_debut) + ses records, si elle existe. */
async function findSession({ teacher_assignment_id, date_cours, heure_debut }) {
  const [[session]] = await pool.query(
    `SELECT id, teacher_assignment_id, timetable_slot_id, date_cours, heure_debut, created_by, created_at
       FROM attendance_sessions
      WHERE teacher_assignment_id = ? AND date_cours = ? AND heure_debut <=> ?`,
    [teacher_assignment_id, date_cours, heure_debut]
  );
  return session || null;
}

async function createSession({ teacher_assignment_id, timetable_slot_id, date_cours, heure_debut, created_by }, conn) {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO attendance_sessions (teacher_assignment_id, timetable_slot_id, date_cours, heure_debut, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [teacher_assignment_id, timetable_slot_id || null, date_cours, heure_debut, created_by]
  );
  return result.insertId;
}

async function upsertRecord({ session_id, enrollment_id, statut, minutes_retard, justification, justification_statut, justification_par, justification_at }, conn) {
  const db = conn || pool;
  await db.query(
    `INSERT INTO attendance_records
       (session_id, enrollment_id, statut, minutes_retard, justification, justification_statut, justification_par, justification_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       statut = VALUES(statut), minutes_retard = VALUES(minutes_retard),
       justification = VALUES(justification), justification_statut = VALUES(justification_statut),
       justification_par = VALUES(justification_par), justification_at = VALUES(justification_at)`,
    [session_id, enrollment_id, statut, minutes_retard ?? null, justification ?? null,
     justification_statut ?? 'NON_JUSTIFIEE', justification_par ?? null, justification_at ?? null]
  );
}

async function deleteRecordsForSession(sessionId, conn) {
  const db = conn || pool;
  await db.query('DELETE FROM attendance_records WHERE session_id = ?', [sessionId]);
}

/** Records d'une séance (jointure élèves pour pré-remplissage). */
async function listRecords(sessionId) {
  const [rows] = await pool.query(
    `SELECT ar.id, ar.enrollment_id, ar.statut, ar.minutes_retard, ar.justification,
            ar.justification_statut, ar.justification_par, ar.justification_at,
            s.matricule, s.nom, s.prenom
       FROM attendance_records ar
       JOIN enrollments e ON e.id = ar.enrollment_id
       JOIN students s ON s.id = e.student_id
      WHERE ar.session_id = ?
      ORDER BY s.nom, s.prenom`,
    [sessionId]
  );
  return rows;
}

/** Records ABSENT/RETARD d'un élève (fiche absences prof/directeur/parent). */
async function listAbsencesEleve(enrollmentId) {
  const [rows] = await pool.query(
    `SELECT ar.id, ar.statut, ar.minutes_retard, ar.justification,
            ar.justification_statut, ar.justification_par, ar.justification_at,
            ats.date_cours, ats.heure_debut, s.nom AS matiere_nom
       FROM attendance_records ar
       JOIN attendance_sessions ats ON ats.id = ar.session_id
       JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
       JOIN class_subjects cs ON cs.id = ta.class_subject_id
       JOIN subjects s ON s.id = cs.subject_id
      WHERE ar.enrollment_id = ? AND ar.statut IN ('ABSENT','RETARD')
      ORDER BY ats.date_cours DESC, ats.heure_debut DESC`,
    [enrollmentId]
  );
  return rows;
}

/** Séances d'appel récentes d'un professeur (historique court + modifiable). */
async function listRecentSessions(teacherAssignmentIds, limit = 30) {
  if (!teacherAssignmentIds.length) return [];
  const placeholders = teacherAssignmentIds.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT s.id, s.teacher_assignment_id, s.date_cours, s.heure_debut,
            s.timetable_slot_id, COUNT(ar.id) AS nb_eleves,
            SUM(ar.statut = 'ABSENT') AS absents, SUM(ar.statut = 'RETARD') AS retards
       FROM attendance_sessions s
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
      WHERE s.teacher_assignment_id IN (${placeholders})
      GROUP BY s.id, s.teacher_assignment_id, s.date_cours, s.heure_debut, s.timetable_slot_id
      ORDER BY s.date_cours DESC, s.heure_debut DESC
      LIMIT ?`,
    [...teacherAssignmentIds, limit]
  );
  return rows;
}

module.exports = { findSession, createSession, upsertRecord, deleteRecordsForSession, listRecords, listAbsencesEleve, listRecentSessions };
