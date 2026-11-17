// Numéros séquentiels par année (matricules MAT-2026-00012, reçus
// REC-2026-000045). Sûr en concurrence : LAST_INSERT_ID() est lié à la
// connexion — d'où usage systématique d'UNE connexion dédiée par appel
// (ou celle de la transaction appelante).
const pool = require('../config/db');

/**
 * Réserve le prochain numéro pour `name` et `year`.
 * @param {object|null} conn connexion transactionnelle optionnelle ; sinon connexion dédiée.
 */
async function nextSequenceValue(name, year, conn = null) {
  if (conn) return incrementer(conn, name, year);
  const dedicatee = await pool.getConnection();
  try {
    await dedicatee.beginTransaction();
    const valeur = await incrementer(dedicatee, name, year);
    await dedicatee.commit();
    return valeur;
  } catch (err) {
    await dedicatee.rollback();
    throw err;
  } finally {
    dedicatee.release();
  }
}

async function incrementer(db, name, year) {
  await db.query(
    `INSERT INTO sequences (name, year, \`last_value\`) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE name = name`,
    [name, year]
  );
  await db.query(
    'UPDATE sequences SET `last_value` = LAST_INSERT_ID(`last_value` + 1) WHERE name = ? AND year = ?',
    [name, year]
  );
  const [[row]] = await db.query('SELECT LAST_INSERT_ID() AS value');
  return row.value;
}

/** MAT-2026-00012 (year = année de début de l'année académique). */
async function nextMatricule(year, conn = null) {
  const value = await nextSequenceValue('MATRICULE', year, conn);
  return `MAT-${year}-${String(value).padStart(5, '0')}`;
}

/** REC-2026-000045 (year = année civile courante). */
async function nextReceiptNumber(year, conn = null) {
  const value = await nextSequenceValue('RECU', year, conn);
  return `REC-${year}-${String(value).padStart(6, '0')}`;
}

module.exports = { nextSequenceValue, nextMatricule, nextReceiptNumber };
