// Refresh tokens : seul le hash SHA-256 est stocké en base.
const pool = require('../config/db');

async function storeToken({ userId, tokenHash, expiresAt, userAgent, ipAddress }) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, tokenHash, expiresAt, userAgent || null, ipAddress || null]
  );
}

async function findValidByHash(tokenHash) {
  const [[row]] = await pool.query(
    `SELECT rt.id, rt.user_id, u.role, u.is_active, u.must_change_password
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > NOW()
      LIMIT 1`,
    [tokenHash]
  );
  return row || null;
}

async function revokeByHash(tokenHash) {
  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [tokenHash]);
}

async function revokeAllForUser(userId) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [userId]
  );
}

module.exports = { storeToken, findValidByHash, revokeByHash, revokeAllForUser };
