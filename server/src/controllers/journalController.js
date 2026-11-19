// Journal d'activités — lecture paginée de audit_logs (réservé à l'Administrateur).
const pool = require('../config/db');
const { parsePagination } = require('../utils/pagination');

/** Liste paginée + filtres (recherche sur l'auteur, action, entité, période). */
async function lister(req, res, next) {
  try {
    const { page, parPage, offset, search } = parsePagination(req.query, { parPageDefaut: 25, parPageMax: 100 });
    const { action, entity, date_debut, date_fin } = req.query;

    const params = [];
    let where = '1 = 1';
    if (action) { where += ' AND a.action = ?'; params.push(String(action)); }
    if (entity) { where += ' AND a.entity = ?'; params.push(String(entity)); }
    if (date_debut) { where += ' AND a.created_at >= ?'; params.push(`${date_debut} 00:00:00`); }
    if (date_fin) { where += ' AND a.created_at <= ?'; params.push(`${date_fin} 23:59:59`); }
    if (search) {
      where += ' AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.old_values, a.new_values, a.ip_address, a.created_at,
              u.id AS user_id, u.nom, u.prenom, u.role
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
        WHERE ${where}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ? OFFSET ?`,
      [...params, parPage, offset]
    );
    res.json({ rows, total, page, parPage });
  } catch (err) { next(err); }
}

/** Valeurs distinctes pour les filtres (action / entité). */
async function filtres(_req, res, next) {
  try {
    const [actions] = await pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
    const [entities] = await pool.query('SELECT DISTINCT entity FROM audit_logs WHERE entity IS NOT NULL ORDER BY entity');
    res.json({ actions: actions.map((r) => r.action), entities: entities.map((r) => r.entity) });
  } catch (err) { next(err); }
}

module.exports = { lister, filtres };
