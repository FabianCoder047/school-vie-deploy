// Inscriptions (enrollments) — requêtes avec jointures complètes.
const pool = require('../config/db');
const { parsePagination } = require('../utils/pagination');

const SELECT_FICHE = `
  SELECT e.id AS enrollment_id, e.student_id, e.academic_year_id, e.class_id, e.class_alias_id,
         e.modalite_paiement, e.frais_inscription, e.montant_scolarite, e.statut, e.date_inscription, e.created_at,
         s.matricule, s.nom, s.prenom, s.sexe, s.date_naissance, s.lieu_naissance, s.adresse, s.photo_path,
         g.id AS guardian_id, g.nom AS tuteur_nom, g.prenom AS tuteur_prenom, g.telephone_whatsapp AS tuteur_whatsapp,
         g.email AS tuteur_email, g.user_id AS parent_user_id,
         cy.nom AS cycle_nom, cy.id AS cycle_id, cl.nom AS classe_nom, a.nom AS alias_nom,
         ay.libelle AS annee_libelle
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN guardians g ON g.id = s.guardian_id
    JOIN class_aliases a ON a.id = e.class_alias_id
    JOIN classes cl ON cl.id = e.class_id
    JOIN cycles cy ON cy.id = cl.cycle_id
    JOIN academic_years ay ON ay.id = e.academic_year_id
`;

/** Liste paginée avec recherche (nom/prénom/matricule) et filtres. */
async function list(query) {
  const { page, parPage, offset, search } = parsePagination(query);
  const parametres = [];
  let where = '1=1';
  if (search) {
    const motif = `%${search}%`;
    parametres.push(motif, motif, motif);
    where += ' AND (s.nom LIKE ? OR s.prenom LIKE ? OR s.matricule LIKE ?)';
  }
  if (query.academic_year_id) { parametres.push(Number(query.academic_year_id)); where += ' AND e.academic_year_id = ?'; }
  if (query.cycle_id) { parametres.push(Number(query.cycle_id)); where += ' AND cy.id = ?'; }
  if (query.class_id) { parametres.push(Number(query.class_id)); where += ' AND e.class_id = ?'; }
  if (query.class_alias_id) { parametres.push(Number(query.class_alias_id)); where += ' AND e.class_alias_id = ?'; }
  if (query.statut) { parametres.push(query.statut); where += ' AND e.statut = ?'; }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_aliases a ON a.id = e.class_alias_id
       JOIN classes cl ON cl.id = e.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id WHERE ${where}`,
    parametres
  );
  const [rows] = await pool.query(
    `${SELECT_FICHE} WHERE ${where} ORDER BY s.nom, s.prenom LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );
  return { rows, total, page, parPage };
}

async function findById(id) {
  const [[row]] = await pool.query(`${SELECT_FICHE} WHERE e.id = ?`, [id]);
  return row || null;
}

/** Recherche par id élève pour l'espace parent / notifications. */
async function findByStudentId(studentId, academicYearId) {
  const [rows] = await pool.query(`${SELECT_FICHE} WHERE e.student_id = ?${academicYearId ? ' AND e.academic_year_id = ?' : ''} ORDER BY ay.date_debut DESC`, academicYearId ? [studentId, academicYearId] : [studentId]);
  return rows;
}

async function create({ student_id, academic_year_id, class_id, class_alias_id, modalite_paiement, frais_inscription, montant_scolarite, statut, date_inscription, created_by }, conn) {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO enrollments (student_id, academic_year_id, class_id, class_alias_id, modalite_paiement, frais_inscription, montant_scolarite, statut, date_inscription, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [student_id, academic_year_id, class_id, class_alias_id, modalite_paiement, frais_inscription, montant_scolarite, statut || 'EN_ATTENTE', date_inscription, created_by]
  );
  return result.insertId;
}

async function updateClasseAlias(id, { class_id, class_alias_id }) {
  await pool.query('UPDATE enrollments SET class_id = ?, class_alias_id = ? WHERE id = ?', [class_id, class_alias_id, id]);
}

async function setStatut(id, statut, conn = null) {
  const db = conn || pool;
  await db.query('UPDATE enrollments SET statut = ? WHERE id = ?', [statut, id]);
}

async function compterInscriptionsAnnee(academicYearId, champDate) {
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM enrollments WHERE academic_year_id = ? AND ${champDate}`,
    [academicYearId]
  );
  return total;
}

/** Effectifs par cycle (dashboard secrétaire). */
async function effectifsParCycle(academicYearId) {
  const [rows] = await pool.query(
    `SELECT cy.nom AS cycle, COUNT(e.id) AS effectif
       FROM cycles cy
       LEFT JOIN classes cl ON cl.cycle_id = cy.id
       LEFT JOIN enrollments e ON e.class_id = cl.id AND e.academic_year_id = ? AND e.statut <> 'ANNULE'
      GROUP BY cy.id, cy.nom, cy.ordre ORDER BY cy.ordre, cy.nom`,
    [academicYearId]
  );
  return rows.map((r) => ({ cycle: r.cycle, effectif: r.effectif }));
}

module.exports = { list, findById, findByStudentId, create, updateClasseAlias, setStatut, compterInscriptionsAnnee, effectifsParCycle };
