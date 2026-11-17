// Classes par cycle — CRUD + contrôles d'usage avant suppression.
const pool = require('../config/db');
const { parsePagination } = require('../utils/pagination');

async function list(query) {
  const { page, parPage, offset, search } = parsePagination(query);
  const parametres = [];
  let where = '1=1';
  if (search) {
    parametres.push(`%${search}%`);
    where += ' AND cl.nom LIKE ?';
  }
  if (query.cycle_id) {
    parametres.push(Number(query.cycle_id));
    where += ' AND cl.cycle_id = ?';
  }
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM classes cl WHERE ${where}`,
    parametres
  );
  const [rows] = await pool.query(
    `SELECT cl.id, cl.cycle_id, cl.nom, cl.ordre, cl.created_at, cy.nom AS cycle_nom
       FROM classes cl JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE ${where}
      ORDER BY cy.ordre, cy.nom, cl.ordre, cl.nom
      LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );
  return { rows, total, page, parPage };
}

async function listAll() {
  const [rows] = await pool.query(
    `SELECT cl.id, cl.cycle_id, cl.nom, cy.nom AS cycle_nom
       FROM classes cl JOIN cycles cy ON cy.id = cl.cycle_id
       ORDER BY cy.ordre, cl.ordre, cl.nom`
  );
  return rows;
}

async function findById(id) {
  const [[row]] = await pool.query('SELECT id, cycle_id, nom, ordre FROM classes WHERE id = ?', [id]);
  return row || null;
}

async function create({ cycle_id, nom, ordre }) {
  const [result] = await pool.query('INSERT INTO classes (cycle_id, nom, ordre) VALUES (?, ?, ?)', [cycle_id, nom, ordre || 0]);
  return findById(result.insertId);
}

async function update(id, { cycle_id, nom, ordre }) {
  await pool.query('UPDATE classes SET cycle_id = ?, nom = ?, ordre = ? WHERE id = ?', [cycle_id, nom, ordre || 0, id]);
  return findById(id);
}

async function compterUsages(id) {
  const [[{ alias }]] = await pool.query('SELECT COUNT(*) AS alias FROM class_aliases WHERE class_id = ?', [id]);
  const [[{ affectations }]] = await pool.query('SELECT COUNT(*) AS affectations FROM class_subjects WHERE class_id = ?', [id]);
  const [[{ frais }]] = await pool.query('SELECT COUNT(*) AS frais FROM tuition_fees WHERE class_id = ?', [id]);
  const [[{ inscriptions }]] = await pool.query('SELECT COUNT(*) AS inscriptions FROM enrollments WHERE class_id = ?', [id]);
  return { alias, affectations, frais, inscriptions, total: alias + affectations + frais + inscriptions };
}

async function remove(id) {
  await pool.query('DELETE FROM classes WHERE id = ?', [id]);
}

module.exports = { list, listAll, findById, create, update, compterUsages, remove };
