// Accès "users" : jamais de password_hash dans les objets renvoyés
// aux couches supérieures sauf via findWithSecrets (usage interne auth).
const pool = require('../config/db');

const PUBLIC_COLUMNS =
  'id, role, nom, prenom, email, telephone, must_change_password, is_active, last_login_at, created_at';

async function findWithSecretsById(id) {
  const [[user]] = await pool.query(
    'SELECT id, role, nom, prenom, email, telephone, password_hash, must_change_password, is_active FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return user || null;
}

async function findWithSecretsByIdentifier(identifier) {
  const value = String(identifier).trim().toLowerCase();
  const [[user]] = await pool.query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash, failed_login_attempts, locked_until
       FROM users
      WHERE LOWER(email) = ? OR telephone = ?
      LIMIT 1`,
    [value, String(identifier).trim()]
  );
  return user || null;
}

async function findById(id) {
  const [[user]] = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return user || null;
}

async function recordFailedLogin(userId, attempts, lockUntil) {
  await pool.query(
    'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
    [attempts, lockUntil, userId]
  );
}

async function resetFailedLogin(userId) {
  await pool.query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
    [userId]
  );
}

async function updatePassword(userId, passwordHash) {
  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
    [passwordHash, userId]
  );
}

module.exports = {
  findWithSecretsByIdentifier,
  findWithSecretsById,
  findById,
  recordFailedLogin,
  resetFailedLogin,
  updatePassword,
};
