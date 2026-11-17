// Années académiques — CRUD + bascule de l'année courante (transaction).
const pool = require('../config/db');
const { parsePagination } = require('../utils/pagination');

async function list(query) {
  const { page, parPage, offset, search } = parsePagination(query);
  const parametres = [];
  let where = '1=1';
  if (search) {
    parametres.push(`%${search}%`);
    where += ' AND libelle LIKE ?';
  }
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM academic_years WHERE ${where}`, parametres);
  const [rows] = await pool.query(
    `SELECT id, libelle, date_debut, date_fin, is_current, created_at
       FROM academic_years WHERE ${where} ORDER BY date_debut DESC LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );
  return { rows, total, page, parPage };
}

async function listAll() {
  const [rows] = await pool.query('SELECT id, libelle, is_current FROM academic_years ORDER BY date_debut DESC');
  return rows;
}

async function findById(id) {
  const [[row]] = await pool.query('SELECT id, libelle, date_debut, date_fin, is_current FROM academic_years WHERE id = ?', [id]);
  return row || null;
}

async function findCurrent() {
  const [[row]] = await pool.query('SELECT id, libelle FROM academic_years WHERE is_current = 1 LIMIT 1');
  return row || null;
}

async function create({ libelle, date_debut, date_fin }) {
  const [result] = await pool.query(
    'INSERT INTO academic_years (libelle, date_debut, date_fin, is_current) VALUES (?, ?, ?, 0)',
    [libelle, date_debut, date_fin]
  );
  return findById(result.insertId);
}

async function update(id, { libelle, date_debut, date_fin }) {
  await pool.query('UPDATE academic_years SET libelle = ?, date_debut = ?, date_fin = ? WHERE id = ?', [libelle, date_debut, date_fin, id]);
  return findById(id);
}

/** Bascule is_current : une seule année courante (service-level guarantee, transaction). */
async function setCurrent(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE academic_years SET is_current = 0 WHERE is_current = 1');
    await conn.query('UPDATE academic_years SET is_current = 1 WHERE id = ?', [id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return findById(id);
}

/** Compte les usages bloquants pour la suppression. */
async function compterUsages(id) {
  const tables = [
    ['enrollments', 'inscriptions'],
    ['teacher_assignments', 'affectations'],
    ['tuition_fees', 'frais'],
    ['timetable_slots', 'creneaux'],
    ['evaluation_periods', 'periodes'],
  ];
  const detail = {};
  let total = 0;
  for (const [table, cle] of tables) {
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE academic_year_id = ?`, [id]);
    detail[cle] = n;
    total += n;
  }
  return { ...detail, total };
}

async function remove(id) {
  await pool.query('DELETE FROM academic_years WHERE id = ?', [id]);
}

module.exports = { list, listAll, findById, findCurrent, create, update, setCurrent, compterUsages, remove };
