// Gestion des comptes utilisateurs (création par Admin/Directeur,
// activation, renvoi des identifiants). Ne renvoie jamais password_hash.
const pool = require('../config/db');
const { parsePagination } = require('../utils/pagination');

const PUBLIC = 'id, role, nom, prenom, email, telephone, must_change_password, is_active, last_login_at, created_at';

async function list(query, roles) {
  const { page, parPage, offset, search } = parsePagination(query);
  const parametres = [...roles];
  let where = `role IN (${roles.map(() => '?').join(',')})`;
  if (search) {
    const motif = `%${search}%`;
    parametres.push(motif, motif, motif, motif);
    where += ' AND (nom LIKE ? OR prenom LIKE ? OR email LIKE ? OR telephone LIKE ?)';
  }
  if (query.role && roles.includes(query.role)) {
    parametres.push(query.role);
    where += ' AND role = ?';
  }
  if (query.is_active !== undefined && query.is_active !== '') {
    parametres.push(query.is_active === '1' || query.is_active === 'true' ? 1 : 0);
    where += ' AND is_active = ?';
  }
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE ${where}`, parametres);
  const [rows] = await pool.query(
    `SELECT ${PUBLIC} FROM users WHERE ${where} ORDER BY nom, prenom LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );
  return { rows, total, page, parPage };
}

async function findById(id) {
  const [[row]] = await pool.query(`SELECT ${PUBLIC} FROM users WHERE id = ?`, [id]);
  return row || null;
}

async function existeEmailOuTelephone(email, telephone, excludeId = null) {
  const parametres = [];
  const clauses = [];
  if (email) { clauses.push('email = ?'); parametres.push(email); }
  if (telephone) { clauses.push('telephone = ?'); parametres.push(telephone); }
  if (clauses.length === 0) return false;
  let sql = `SELECT id FROM users WHERE (${clauses.join(' OR ')})`;
  if (excludeId) { sql += ' AND id <> ?'; parametres.push(excludeId); }
  const [rows] = await pool.query(sql, parametres);
  return rows.length > 0;
}

async function create({ role, nom, prenom, email, telephone, passwordHash, createdBy }, conn = null) {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO users (role, nom, prenom, email, telephone, password_hash, must_change_password, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)`,
    [role, nom, prenom, email || null, telephone || null, passwordHash, createdBy || null]
  );
  const PUBLIC = 'id, role, nom, prenom, email, telephone, must_change_password, is_active, last_login_at, created_at';
  const [[user]] = await db.query(`SELECT ${PUBLIC} FROM users WHERE id = ?`, [result.insertId]);
  return user || null;
}

async function setActive(id, isActive) {
  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return findById(id);
}

/** Remplace le mot de passe par un nouveau hash temporaire (must_change_password=1). */
async function setTemporaryPassword(id, passwordHash) {
  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
    [passwordHash, id]
  );
}

/** Variante légère pour vérification de périmètre (id + rôle uniquement). */
async function findLightByPhone(telephone) {
  const [[row]] = await pool.query('SELECT id, role FROM users WHERE telephone = ? LIMIT 1', [telephone]);
  return row || null;
}

async function findLightByEmail(email) {
  const [[row]] = await pool.query('SELECT id, role FROM users WHERE email = ? LIMIT 1', [email]);
  return row || null;
}

async function listProfesseurs() {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC} FROM users WHERE role = 'PROFESSEUR' AND is_active = 1 ORDER BY nom, prenom`
  );
  return rows;
}

module.exports = { list, findById, existeEmailOuTelephone, create, setActive, setTemporaryPassword, listProfesseurs, findLightByPhone, findLightByEmail };
