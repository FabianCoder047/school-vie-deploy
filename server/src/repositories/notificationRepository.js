// Notifications internes (cloche) : liste paginée, non-lus, marquer lu.
const pool = require('../config/db');
const { parsePagination } = require('../utils/pagination');

async function create({ user_id, type, titre, message, data }, conn = null) {
  const db = conn || pool;
  const [result] = await db.query(
    'INSERT INTO notifications (user_id, type, titre, message, data) VALUES (?, ?, ?, ?, ?)',
    [user_id, type, titre, message, data ? JSON.stringify(data) : null]
  );
  return result.insertId;
}

/** Liste paginée, plus récente d'abord. */
async function listByUser(userId, query = {}) {
  const { page, parPage, offset } = parsePagination(query, { parPageDefaut: 15 });
  const parametres = [userId];
  let where = 'user_id = ?';
  if (query.unread === '1' || query.unread === 'true') where += ' AND read_at IS NULL';
  if (query.type) { parametres.push(query.type); where += ' AND type = ?'; }
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM notifications WHERE ${where}`, parametres);
  const [rows] = await pool.query(
    `SELECT id, type, titre, message, data, read_at, created_at
       FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );
  return { rows, total, page, parPage };
}

async function compterNonLues(userId) {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
  return n;
}

async function marquerLue(id, userId) {
  const [result] = await pool.query(
    'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL',
    [id, userId]
  );
  return result.affectedRows > 0;
}

async function marquerToutesLues(userId) {
  const [result] = await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [userId]);
  return result.affectedRows;
}

module.exports = { create, listByUser, compterNonLues, marquerLue, marquerToutesLues };
