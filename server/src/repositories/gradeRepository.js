// Notes : lecture / écriture (upsert) des relevés par (élève, matière, période).
const pool = require('../config/db');

/** Notes existantes pour (alias, matière via class_subject, période) avec élèves inscrits. */
async function listSheet({ classAliasId, classSubjectId, evaluationPeriodId, academicYearId }) {
  const [rows] = await pool.query(
    `SELECT e.id AS enrollment_id, s.matricule, s.nom, s.prenom, s.photo_path,
            g.interro, g.devoir, g.compo, g.appreciation, g.entered_by
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN grades g ON g.enrollment_id = e.id
                        AND g.class_subject_id = ?
                        AND g.evaluation_period_id = ?
      WHERE e.class_alias_id = ? AND e.academic_year_id = ? AND e.statut <> 'ANNULE'
      ORDER BY s.nom, s.prenom`,
    [classSubjectId, evaluationPeriodId, classAliasId, academicYearId]
  );
  return rows;
}

/** Upsert d'une note (UNIQUE KEY uq_grade). */
async function upsertGrade({ enrollment_id, class_subject_id, evaluation_period_id, interro, devoir, compo, appreciation, entered_by }, conn) {
  const db = conn || pool;
  await db.query(
    `INSERT INTO grades (enrollment_id, class_subject_id, evaluation_period_id, interro, devoir, compo, appreciation, entered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE interro = VALUES(interro), devoir = VALUES(devoir), compo = VALUES(compo),
                             appreciation = VALUES(appreciation), entered_by = VALUES(entered_by)`,
    [
      enrollment_id,
      class_subject_id,
      evaluation_period_id,
      interro ?? null,
      devoir ?? null,
      compo ?? null,
      appreciation ?? null,
      entered_by,
    ]
  );
}

/** Statistiques par classe pour les dashboards professeurs. */
async function moyennesParClasse(academicYearId) {
  // Moyenne générale par classe/alias sur toutes les matières et périodes.
  const [rows] = await pool.query(
    `SELECT e.class_alias_id, a.nom AS alias_nom, cl.nom AS classe_nom,
            g.interro, g.devoir, g.compo, cs.coefficient
       FROM grades g
       JOIN enrollments e ON e.id = g.enrollment_id
       JOIN class_subjects cs ON cs.id = g.class_subject_id
       JOIN class_aliases a ON a.id = e.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
      WHERE e.academic_year_id = ?`,
    [academicYearId]
  );
  return rows;
}

module.exports = { listSheet, upsertGrade, moyennesParClasse };
