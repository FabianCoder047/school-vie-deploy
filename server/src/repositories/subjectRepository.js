// Matières — CRUD + contrôle d'usage avant suppression.
const pool = require('../config/db');
const { parsePagination } = require('../utils/pagination');

async function list(query) {
  const { page, parPage, offset, search } = parsePagination(query);
  const parametres = [];
  let where = '1=1';
  if (search) {
    parametres.push(`%${search}%`);
    where += ' AND (nom LIKE ? OR code LIKE ?)';
    parametres.push(`%${search}%`);
  }
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM subjects WHERE ${where}`, parametres);
  const [rows] = await pool.query(
    `SELECT id, nom, code, created_at FROM subjects WHERE ${where} ORDER BY nom LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );
  return { rows, total, page, parPage };
}

async function listAll() {
  const [rows] = await pool.query('SELECT id, nom, code FROM subjects ORDER BY nom');
  return rows;
}

async function findById(id) {
  const [[row]] = await pool.query('SELECT id, nom, code FROM subjects WHERE id = ?', [id]);
  return row || null;
}

async function create({ nom, code }) {
  const [result] = await pool.query('INSERT INTO subjects (nom, code) VALUES (?, ?)', [nom, code || null]);
  return findById(result.insertId);
}

async function update(id, { nom, code }) {
  await pool.query('UPDATE subjects SET nom = ?, code = ? WHERE id = ?', [nom, code || null, id]);
  return findById(id);
}

async function compterAffectations(id) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM class_subjects WHERE subject_id = ?', [id]);
  return total;
}

async function remove(id) {
  await pool.query('DELETE FROM subjects WHERE id = ?', [id]);
}

module.exports = { list, listAll, findById, create, update, compterAffectations, remove };
