// Frais de scolarité par (année, classe) + modalités autorisées.
const pool = require('../config/db');

/** Liste des frais d'une année avec classes, cycle et modalités. */
async function listByYear(academicYearId) {
  const [rows] = await pool.query(
    `SELECT tf.id, tf.academic_year_id, tf.class_id, tf.frais_inscription, tf.montant_scolarite,
            cl.nom AS classe_nom, cl.ordre AS classe_ordre, cy.nom AS cycle_nom, cy.id AS cycle_id,
            (SELECT GROUP_CONCAT(modalite ORDER BY FIELD(modalite,'JOURNALIER','HEBDOMADAIRE','MENSUEL','TRIMESTRIEL','SEMESTRIEL'))
               FROM tuition_fee_modalities m WHERE m.tuition_fee_id = tf.id) AS modalites
       FROM tuition_fees tf
       JOIN classes cl ON cl.id = tf.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE tf.academic_year_id = ?
      ORDER BY cy.ordre, cl.ordre, cl.nom`,
    [academicYearId]
  );
  return rows.map((r) => ({ ...r, modalites: r.modalites ? r.modalites.split(',') : [] }));
}

/** Frais + modalités d'une classe pour une année (ou null). */
async function findByYearAndClass(academicYearId, classId) {
  const [[row]] = await pool.query(
    `SELECT tf.id, tf.academic_year_id, tf.class_id, tf.frais_inscription, tf.montant_scolarite
       FROM tuition_fees tf WHERE tf.academic_year_id = ? AND tf.class_id = ?`,
    [academicYearId, classId]
  );
  if (!row) return null;
  const [modalites] = await pool.query('SELECT modalite FROM tuition_fee_modalities WHERE tuition_fee_id = ?', [row.id]);
  return { ...row, modalites: modalites.map((m) => m.modalite) };
}

/** Upsert frais d'une classe (transaction gérée par le service). */
async function upsertFee(conn, { academic_year_id, class_id, frais_inscription, montant_scolarite }) {
  await conn.query(
    `INSERT INTO tuition_fees (academic_year_id, class_id, frais_inscription, montant_scolarite)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE frais_inscription = VALUES(frais_inscription), montant_scolarite = VALUES(montant_scolarite)`,
    [academic_year_id, class_id, frais_inscription, montant_scolarite]
  );
  const [[row]] = await conn.query(
    'SELECT id FROM tuition_fees WHERE academic_year_id = ? AND class_id = ?',
    [academic_year_id, class_id]
  );
  return row.id;
}

/** Remplace les modalités cochées pour un frais (dans une transaction). */
async function replaceModalities(conn, tuitionFeeId, modalites) {
  await conn.query('DELETE FROM tuition_fee_modalities WHERE tuition_fee_id = ?', [tuitionFeeId]);
  for (const modalite of modalites) {
    await conn.query('INSERT INTO tuition_fee_modalities (tuition_fee_id, modalite) VALUES (?, ?)', [tuitionFeeId, modalite]);
  }
}

/** Pour le formulaire d'inscription : classes + frais de l'année (pour cascade). */
async function listFeesForYear(academicYearId) {
  const [rows] = await pool.query(
    `SELECT cl.id AS class_id, cl.nom AS classe_nom, cy.id AS cycle_id, cy.nom AS cycle_nom,
            tf.frais_inscription, tf.montant_scolarite,
            (SELECT GROUP_CONCAT(modalite) FROM tuition_fee_modalities m WHERE m.tuition_fee_id = tf.id) AS modalites
       FROM classes cl
       JOIN cycles cy ON cy.id = cl.cycle_id
       LEFT JOIN tuition_fees tf ON tf.class_id = cl.id AND tf.academic_year_id = ?
       ORDER BY cy.ordre, cl.ordre, cl.nom`,
    [academicYearId]
  );
  return rows.map((r) => ({ ...r, modalites: r.modalites ? r.modalites.split(',') : [] }));
}

module.exports = { listByYear, findByYearAndClass, upsertFee, replaceModalities, listFeesForYear };
