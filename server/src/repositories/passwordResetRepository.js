// Tokens de réinitialisation de mot de passe : hash SHA-256 en base,
// usage unique, expiration courte.
const pool = require('../config/db');

async function storeResetToken({ userId, tokenHash, expiresAt }) {
  await pool.query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
}

async function findValidByHash(tokenHash) {
  const [[row]] = await pool.query(
    `SELECT id, user_id FROM password_resets
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
      LIMIT 1`,
    [tokenHash]
  );
  return row || null;
}

async function markUsed(id) {
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [id]);
}

module.exports = { storeResetToken, findValidByHash, markUsed };
