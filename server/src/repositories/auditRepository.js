// Écriture centralisée dans audit_logs (jamais de données sensibles).
const pool = require('../config/db');
const logger = require('../utils/logger');

async function log({ userId = null, action, entity = null, entityId = null, oldValues = null, newValues = null, ipAddress = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, old_values, new_values, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entity,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
      ]
    );
  } catch (err) {
    // L'audit ne doit jamais faire échouer la requête métier, mais on trace l'échec.
    logger.error('Écriture audit_logs impossible', { message: err.message, action });
  }
}

module.exports = { log };
