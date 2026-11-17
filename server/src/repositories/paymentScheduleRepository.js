// Échéancier de paiement (payment_schedules).
const pool = require('../config/db');

async function insertBatch(lignes, conn) {
  const db = conn || pool;
  for (const l of lignes) {
    await db.query(
      `INSERT INTO payment_schedules (enrollment_id, numero, date_echeance, montant_du, montant_paye, statut)
       VALUES (?, ?, ?, ?, 0, 'A_PAYER')`,
      [l.enrollment_id, l.numero, l.date_echeance, l.montant_du]
    );
  }
}

async function listByEnrollment(enrollmentId) {
  const [rows] = await pool.query(
    `SELECT id, numero, date_echeance, montant_du, montant_paye, statut
       FROM payment_schedules WHERE enrollment_id = ? ORDER BY numero`,
    [enrollmentId]
  );
  return rows;
}

/** Échéances non soldées, les plus anciennes d'abord (pour ventilation). */
async function findOuvertes(enrollmentId, conn) {
  const db = conn || pool;
  const [rows] = await db.query(
    `SELECT id, numero, montant_du, montant_paye, statut
       FROM payment_schedules
      WHERE enrollment_id = ? AND statut <> 'PAYE'
      ORDER BY numero FOR UPDATE`,
    [enrollmentId]
  );
  return rows;
}

async function appliquerRegle(echeanceId, nouveauMontantPaye, nouveauStatut, conn) {
  const db = conn || pool;
  await db.query(
    'UPDATE payment_schedules SET montant_paye = ?, statut = ? WHERE id = ?',
    [nouveauMontantPaye, nouveauStatut, echeanceId]
  );
}

/** Totaux agrégés (SQL, DECIMAL) pour une inscription ou un ensemble. */
async function totaux(enrollmentIds) {
  if (enrollmentIds.length === 0) return new Map();
  const placeholders = enrollmentIds.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT enrollment_id,
            COALESCE(SUM(montant_du), 0)  AS total_du,
            COALESCE(SUM(montant_paye), 0) AS total_paye
       FROM payment_schedules
      WHERE enrollment_id IN (${placeholders})
      GROUP BY enrollment_id`,
    enrollmentIds
  );
  return new Map(rows.map((r) => [r.enrollment_id, { total_du: r.total_du, total_paye: r.total_paye }]));
}

/** Supprime tout l'échéancier (réservé aux corrections admin futures). */
// eslint-disable-next-line no-unused-vars
async function removeAll(enrollmentId, conn = null) {
  const db = conn || pool;
  await db.query('DELETE FROM payment_schedules WHERE enrollment_id = ?', [enrollmentId]);
}

module.exports = { insertBatch, listByEnrollment, findOuvertes, appliquerRegle, totaux, removeAll };
