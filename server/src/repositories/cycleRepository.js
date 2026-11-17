// Cycles scolaires — CRUD + contrôle d'usage avant suppression.
const pool = require('../config/db');
const { parsePagination } = require('../utils/pagination');

async function list(query) {
  const { page, parPage, offset, search } = parsePagination(query);
  const parametres = [];
  let where = '1=1';
  if (search) {
    const motif = `%${search}%`;
    parametres.push(motif, motif);
    where += ' AND (nom LIKE ? OR description LIKE ?)';
  }
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM cycles WHERE ${where}`, parametres);
  const [rows] = await pool.query(
    `SELECT id, nom, description, ordre, created_at FROM cycles WHERE ${where} ORDER BY ordre, nom LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );
  return { rows, total, page, parPage };
}

async function findById(id) {
  const [[row]] = await pool.query('SELECT id, nom, description, ordre FROM cycles WHERE id = ?', [id]);
  return row || null;
}

async function create({ nom, description, ordre }) {
  const [result] = await pool.query(
    'INSERT INTO cycles (nom, description, ordre) VALUES (?, ?, ?)',
    [nom, description || null, ordre || 0]
  );
  return findById(result.insertId);
}

async function update(id, { nom, description, ordre }) {
  await pool.query('UPDATE cycles SET nom = ?, description = ?, ordre = ? WHERE id = ?', [nom, description || null, ordre || 0, id]);
  return findById(id);
}

async function compterClasses(id) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM classes WHERE cycle_id = ?', [id]);
  return total;
}

async function remove(id) {
  await pool.query('DELETE FROM cycles WHERE id = ?', [id]);
}

module.exports = { list, findById, create, update, compterClasses, remove };
