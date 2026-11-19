// Créneaux d'emploi du temps (hebdomadaires, durée = nb_heures × 55 min).
const pool = require('../config/db');

const SELECT_CRENEAU = `
  SELECT ts.id, ts.academic_year_id, ts.class_alias_id, ts.teacher_assignment_id,
         ts.jour_semaine, ts.heure_debut, ts.heure_fin, ts.nb_heures, ts.duree_libre, ts.salle, ts.created_at,
         u.id AS teacher_id, u.nom AS prof_nom, u.prenom AS prof_prenom,
         s.nom AS matiere_nom, cl.nom AS classe_nom, a.nom AS alias_nom, cy.nom AS cycle_nom
    FROM timetable_slots ts
    JOIN teacher_assignments ta ON ta.id = ts.teacher_assignment_id
    JOIN users u ON u.id = ta.teacher_id
    JOIN class_subjects cs ON cs.id = ta.class_subject_id
    JOIN subjects s ON s.id = cs.subject_id
    JOIN class_aliases a ON a.id = ts.class_alias_id
    JOIN classes cl ON cl.id = a.class_id
    JOIN cycles cy ON cy.id = cl.cycle_id
`;

async function listByAlias(academicYearId, classAliasId) {
  const [rows] = await pool.query(
    `${SELECT_CRENEAU} WHERE ts.academic_year_id = ? AND ts.class_alias_id = ? ORDER BY ts.jour_semaine, ts.heure_debut`,
    [academicYearId, classAliasId]
  );
  return rows;
}

async function listByTeacher(academicYearId, teacherId) {
  const [rows] = await pool.query(
    `${SELECT_CRENEAU} WHERE ts.academic_year_id = ? AND ta.teacher_id = ? ORDER BY ts.jour_semaine, ts.heure_debut`,
    [academicYearId, teacherId]
  );
  return rows;
}

async function findById(id) {
  const [[row]] = await pool.query(`${SELECT_CRENEAU} WHERE ts.id = ?`, [id]);
  return row || null;
}

async function create({ academic_year_id, class_alias_id, teacher_assignment_id, jour_semaine, heure_debut, heure_fin, nb_heures, duree_libre, salle }) {
  const [result] = await pool.query(
    `INSERT INTO timetable_slots (academic_year_id, class_alias_id, teacher_assignment_id, jour_semaine, heure_debut, heure_fin, nb_heures, duree_libre, salle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [academic_year_id, class_alias_id, teacher_assignment_id, jour_semaine, heure_debut, heure_fin, nb_heures, duree_libre ? 1 : 0, salle || null]
  );
  return findById(result.insertId);
}

async function update(id, { class_alias_id, teacher_assignment_id, jour_semaine, heure_debut, heure_fin, nb_heures, duree_libre, salle }) {
  await pool.query(
    `UPDATE timetable_slots
        SET class_alias_id = ?, teacher_assignment_id = ?, jour_semaine = ?, heure_debut = ?, heure_fin = ?,
            nb_heures = ?, duree_libre = ?, salle = ?
      WHERE id = ?`,
    [class_alias_id, teacher_assignment_id, jour_semaine, heure_debut, heure_fin, nb_heures, duree_libre ? 1 : 0, salle || null, id]
  );
  return findById(id);
}

async function remove(id) {
  await pool.query('DELETE FROM timetable_slots WHERE id = ?', [id]);
}

/**
 * Créneaux potentiellement conflictuels (hors soi-même si excludeId) :
 * même jour + même année + (même alias OU même professeur OU même salle renseignée).
 */
async function findConflits({ academicYearId, jourSemaine, classAliasId, teacherId, salle, excludeId = null }) {
  const parametres = [academicYearId, jourSemaine];
  let clauseConflit = '(ts.class_alias_id = ? OR ta.teacher_id = ?';
  parametres.push(classAliasId, teacherId);
  if (salle) {
    clauseConflit += ' OR LOWER(ts.salle) = LOWER(?)';
    parametres.push(salle);
  }
  clauseConflit += ')';
  let exclusion = '';
  if (excludeId) {
    exclusion = ' AND ts.id <> ?';
    parametres.push(excludeId);
  }
  const [rows] = await pool.query(
    `${SELECT_CRENEAU}
      WHERE ts.academic_year_id = ? AND ts.jour_semaine = ? AND ${clauseConflit}${exclusion}
      ORDER BY ts.heure_debut`,
    parametres
  );
  return rows;
}

/** Affectations prof × alias de l'année (pour choisir la matière/alias d'un créneau). */
async function assignmentsForAlias(academicYearId, classAliasId) {
  const [rows] = await pool.query(
    `SELECT ta.id AS teacher_assignment_id, u.nom AS prof_nom, u.prenom AS prof_prenom,
            s.nom AS matiere_nom, s.id AS subject_id
       FROM teacher_assignments ta
       JOIN users u ON u.id = ta.teacher_id
       JOIN class_subjects cs ON cs.id = ta.class_subject_id
       JOIN subjects s ON s.id = cs.subject_id
      WHERE ta.academic_year_id = ? AND ta.class_alias_id = ?
      ORDER BY s.nom`,
    [academicYearId, classAliasId]
  );
  return rows;
}

module.exports = {
  listByAlias,
  listByTeacher,
  findById,
  create,
  update,
  remove,
  findConflits,
  assignmentsForAlias,
};
