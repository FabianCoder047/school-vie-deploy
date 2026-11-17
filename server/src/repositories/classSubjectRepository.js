// Affectation d'une matière à des classes + coefficient par classe
// (class_subjects). Pas de rattachement à une année : coefficients par classe.
const pool = require('../config/db');

/** Liste détaillée : matière + classe + coefficient, filtrable. */
async function listDetailed({ class_id, subject_id } = {}) {
  const parametres = [];
  let where = '1=1';
  if (class_id) { parametres.push(Number(class_id)); where += ' AND cs.class_id = ?'; }
  if (subject_id) { parametres.push(Number(subject_id)); where += ' AND cs.subject_id = ?'; }
  const [rows] = await pool.query(
    `SELECT cs.id, cs.class_id, cs.subject_id, cs.coefficient,
            s.nom AS matiere_nom, s.code AS matiere_code,
            cl.nom AS classe_nom, cy.nom AS cycle_nom, cy.id AS cycle_id
       FROM class_subjects cs
       JOIN subjects s  ON s.id  = cs.subject_id
       JOIN classes cl  ON cl.id = cs.class_id
       JOIN cycles cy   ON cy.id = cl.cycle_id
      WHERE ${where}
      ORDER BY cy.ordre, cl.ordre, s.nom`,
    parametres
  );
  return rows;
}

/** Upsert en masse d'une matière sur plusieurs classes (transaction). */
async function upsertBulk(subjectId, affectations) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { class_id: classId, coefficient } of affectations) {
      await conn.query(
        `INSERT INTO class_subjects (class_id, subject_id, coefficient)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE coefficient = VALUES(coefficient)`,
        [classId, subjectId, coefficient]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Supprime une affectation matière↔classe (utilisé avant de la ré-affecter). */
async function remove(id) {
  await pool.query('DELETE FROM class_subjects WHERE id = ?', [id]);
}

async function findById(id) {
  const [[row]] = await pool.query(
    `SELECT cs.id, cs.class_id, cs.subject_id, cs.coefficient, s.nom AS matiere_nom, cl.nom AS classe_nom
       FROM class_subjects cs
       JOIN subjects s ON s.id = cs.subject_id
       JOIN classes cl ON cl.id = cs.class_id
      WHERE cs.id = ?`,
    [id]
  );
  return row || null;
}

/** Nombre d'affectations professeur utilisant cette ligne matière↔classe. */
async function compterAffectationsProfesseur(id) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM teacher_assignments WHERE class_subject_id = ?', [id]);
  return total;
}

module.exports = { listDetailed, upsertBulk, remove, findById, compterAffectationsProfesseur };
