// Affectations professeur → (matière d'une classe × alias × année).
const pool = require('../config/db');

/** Liste détaillée avec professeurs / matière / alias / classe. */
async function listDetailed({ academic_year_id, teacher_id, class_alias_id } = {}) {
  const parametres = [];
  let where = '1=1';
  if (academic_year_id) { parametres.push(Number(academic_year_id)); where += ' AND ta.academic_year_id = ?'; }
  if (teacher_id) { parametres.push(Number(teacher_id)); where += ' AND ta.teacher_id = ?'; }
  if (class_alias_id) { parametres.push(Number(class_alias_id)); where += ' AND ta.class_alias_id = ?'; }
  const [rows] = await pool.query(
    `SELECT ta.id, ta.academic_year_id, ta.teacher_id, ta.class_subject_id, ta.class_alias_id,
            u.nom AS prof_nom, u.prenom AS prof_prenom,
            s.nom AS matiere_nom, cl.nom AS classe_nom, a.nom AS alias_nom,
            cs.coefficient, ay.libelle AS annee_libelle
       FROM teacher_assignments ta
       JOIN users u           ON u.id  = ta.teacher_id
       JOIN class_subjects cs ON cs.id = ta.class_subject_id
       JOIN subjects s        ON s.id  = cs.subject_id
       JOIN classes cl        ON cl.id = cs.class_id
       JOIN class_aliases a   ON a.id  = ta.class_alias_id
       JOIN academic_years ay ON ay.id = ta.academic_year_id
      WHERE ${where}
      ORDER BY ay.date_debut DESC, cl.nom, a.nom, s.nom, u.nom`,
    parametres
  );
  return rows;
}

/** Affectation existante pour la même clé (année, matière-de-classe, alias) — quel que soit le prof. */
async function findConflit(academicYearId, classSubjectId, classAliasId) {
  const [[row]] = await pool.query(
    `SELECT ta.id, u.nom, u.prenom
       FROM teacher_assignments ta JOIN users u ON u.id = ta.teacher_id
      WHERE ta.academic_year_id = ? AND ta.class_subject_id = ? AND ta.class_alias_id = ?`,
    [academicYearId, classSubjectId, classAliasId]
  );
  return row || null;
}

async function create({ academic_year_id, teacher_id, class_subject_id, class_alias_id }) {
  const [result] = await pool.query(
    `INSERT INTO teacher_assignments (academic_year_id, teacher_id, class_subject_id, class_alias_id)
     VALUES (?, ?, ?, ?)`,
    [academic_year_id, teacher_id, class_subject_id, class_alias_id]
  );
  return result.insertId;
}

/** Règle métier : l'alias doit appartenir à la classe de la matière affectée. */
async function aliasAppartientALaClasseMatiere(classSubjectId, classAliasId) {
  const [[row]] = await pool.query(
    `SELECT cs.id
       FROM class_subjects cs
       JOIN class_aliases a ON a.class_id = cs.class_id
      WHERE cs.id = ? AND a.id = ?`,
    [classSubjectId, classAliasId]
  );
  return Boolean(row);
}

async function findById(id) {
  const [[row]] = await pool.query(
    `SELECT ta.id, ta.academic_year_id, ta.teacher_id, s.nom AS matiere_nom, cl.nom AS classe_nom, a.nom AS alias_nom
       FROM teacher_assignments ta
       JOIN class_subjects cs ON cs.id = ta.class_subject_id
       JOIN subjects s  ON s.id  = cs.subject_id
       JOIN classes cl  ON cl.id = cs.class_id
       JOIN class_aliases a ON a.id = ta.class_alias_id
      WHERE ta.id = ?`,
    [id]
  );
  return row || null;
}

async function countCreneaux(id) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM timetable_slots WHERE teacher_assignment_id = ?', [id]);
  return total;
}

async function remove(id) {
  await pool.query('DELETE FROM teacher_assignments WHERE id = ?', [id]);
}

module.exports = { listDetailed, findConflit, create, aliasAppartientALaClasseMatiere, findById, countCreneaux, remove };
