// Paiements (payments) + ventilation (payment_allocations) + relances.
const pool = require('../config/db');

/* ===== PAIEMENTS ===== */
async function create({ enrollment_id, type, montant, moyen, reference_transaction, numero_recu, date_paiement, created_by }, conn) {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO payments (enrollment_id, type, montant, moyen, reference_transaction, numero_recu, date_paiement, statut, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'VALIDE', ?)`,
    [enrollment_id, type, montant, moyen, reference_transaction || null, numero_recu, date_paiement, created_by]
  );
  return result.insertId;
}

async function findById(id) {
  const [[row]] = await pool.query(
    `SELECT p.id, p.enrollment_id, p.type, p.montant, p.moyen, p.reference_transaction, p.numero_recu,
            p.date_paiement, p.statut, p.motif_annulation, p.justificatif_chemin, p.justificatif_at, p.created_at,
            u.nom AS saisi_par_nom, u.prenom AS saisi_par_prenom
       FROM payments p JOIN users u ON u.id = p.created_by
      WHERE p.id = ?`,
    [id]
  );
  return row || null;
}

async function existsInscriptionValide(enrollmentId) {
  const [[{ n }]] = await pool.query(
    "SELECT COUNT(*) AS n FROM payments WHERE enrollment_id = ? AND type = 'INSCRIPTION' AND statut = 'VALIDE'",
    [enrollmentId]
  );
  return n > 0;
}

async function listByEnrollment(enrollmentId) {
  const [rows] = await pool.query(
    `SELECT p.id, p.type, p.montant, p.moyen, p.reference_transaction, p.numero_recu, p.date_paiement, p.statut, p.motif_annulation,
            p.justificatif_chemin, p.justificatif_at,
            CONCAT(u.prenom, ' ', u.nom) AS saisi_par
       FROM payments p JOIN users u ON u.id = p.created_by
      WHERE p.enrollment_id = ? ORDER BY p.date_paiement, p.id`,
    [enrollmentId]
  );
  return rows;
}

/** Pose (ou retire, si chemin = null) le justificatif scanné d'un reçu. */
async function setJustificatif(id, chemin) {
  await pool.query(
    'UPDATE payments SET justificatif_chemin = ?, justificatif_at = ? WHERE id = ?',
    [chemin, chemin ? new Date() : null, id]
  );
  return findById(id);
}

async function setStatutAnnule(id, motif, conn) {
  const db = conn || pool;
  await db.query("UPDATE payments SET statut = 'ANNULE', motif_annulation = ? WHERE id = ?", [motif, id]);
}

/** Annule la ventilation d'un paiement (restitution des montants). */
async function reverseAllocations(paymentId, conn) {
  const db = conn || pool;
  const [allocations] = await db.query(
    'SELECT schedule_id, montant FROM payment_allocations WHERE payment_id = ? FOR UPDATE',
    [paymentId]
  );
  for (const a of allocations) {
    const [[echeance]] = await db.query(
      'SELECT montant_du, montant_paye FROM payment_schedules WHERE id = ? FOR UPDATE',
      [a.schedule_id]
    );
    const nouveau = Math.max(0, Number((Number(echeance.montant_paye) - Number(a.montant)).toFixed(2)));
    let statut = 'A_PAYER';
    if (nouveau >= Number(echeance.montant_du)) statut = 'PAYE';
    else if (nouveau > 0) statut = 'PARTIEL';
    await db.query('UPDATE payment_schedules SET montant_paye = ?, statut = ? WHERE id = ?', [nouveau.toFixed(2), statut, a.schedule_id]);
  }
  await db.query('DELETE FROM payment_allocations WHERE payment_id = ?', [paymentId]);
}

/* ===== VENTILATION ===== */
async function insertAllocation({ payment_id, schedule_id, montant }, conn) {
  const db = conn || pool;
  await db.query('INSERT INTO payment_allocations (payment_id, schedule_id, montant) VALUES (?, ?, ?)', [payment_id, schedule_id, montant]);
}

/* ===== TOTAUX / RAPPORTS ===== */
async function totalEncaisse({ academicYearId, dateDebut, dateFin, cycleId, classId } = {}) {
  const parametres = [];
  let where = "p.statut = 'VALIDE' AND p.type = 'SCOLARITE'";
  if (academicYearId) {
    parametres.push(Number(academicYearId));
    where += ' AND e.academic_year_id = ?';
  }
  if (dateDebut && dateFin) {
    parametres.push(dateDebut, `${dateFin} 23:59:59`);
    where += ' AND p.date_paiement BETWEEN ? AND ?';
  }
  if (cycleId) { parametres.push(Number(cycleId)); where += ' AND cy.id = ?'; }
  if (classId) { parametres.push(Number(classId)); where += ' AND e.class_id = ?'; }
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(p.montant), 0) AS total, COUNT(p.id) AS nb
       FROM payments p
       JOIN enrollments e ON e.id = p.enrollment_id
       JOIN classes cl ON cl.id = e.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE ${where}`,
    parametres
  );
  return { total: row.total, nb: row.nb };
}

async function totalEncaisseParMoyen({ academicYearId }) {
  const parametres = [];
  let where = "p.statut = 'VALIDE' AND p.type = 'SCOLARITE'";
  if (academicYearId) { parametres.push(Number(academicYearId)); where += ' AND e.academic_year_id = ?'; }
  const [rows] = await pool.query(
    `SELECT p.moyen, COALESCE(SUM(p.montant), 0) AS total
       FROM payments p JOIN enrollments e ON e.id = p.enrollment_id
      WHERE ${where} GROUP BY p.moyen`,
    parametres
  );
  return rows;
}

/** Encaissements jour par jour sur N jours (graphique dashboard). */
async function encaissementsParJour(academicYearId, jours = 30) {
  const [rows] = await pool.query(
    `SELECT DATE(p.date_paiement) AS jour, COALESCE(SUM(p.montant), 0) AS total
       FROM payments p JOIN enrollments e ON e.id = p.enrollment_id
      WHERE p.statut = 'VALIDE' AND p.type = 'SCOLARITE'
        AND e.academic_year_id = ?
        AND p.date_paiement >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(p.date_paiement) ORDER BY jour`,
    [academicYearId, jours]
  );
  return rows;
}

/** Montant attendu + encaissé + reste PAR CLASSE (rapports). */
async function rapportParClasse({ academicYearId, cycleId }) {
  const parametres = [Number(academicYearId)];
  let cycleFilter = '';
  if (cycleId) { parametres.push(Number(cycleId)); cycleFilter = ' AND cy.id = ?'; }
  const [rows] = await pool.query(
    `SELECT cy.id AS cycle_id, cy.nom AS cycle_nom, cl.id AS class_id, cl.nom AS classe_nom,
            COUNT(DISTINCT e.id) AS effectif,
            COALESCE(SUM(e.montant_scolarite), 0) AS attendu,
            COALESCE((SELECT SUM(p.montant) FROM payments p
                       JOIN enrollments e2 ON e2.id = p.enrollment_id
                      WHERE e2.class_id = cl.id AND e2.academic_year_id = e.academic_year_id
                        AND p.type = 'SCOLARITE' AND p.statut = 'VALIDE'), 0) AS encaisse
       FROM enrollments e
       JOIN classes cl ON cl.id = e.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE e.academic_year_id = ? AND e.statut <> 'ANNULE' ${cycleFilter}
      GROUP BY cy.id, cy.nom, cy.ordre, cl.id, cl.nom, cl.ordre
      ORDER BY cy.ordre, cl.ordre, cl.nom`,
    parametres
  );
  return rows;
}

/* ===== RELANCES ===== */
async function insertReminder({ enrollment_id, schedule_id, canal, message, statut, sent_by }, conn = null) {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO payment_reminders (enrollment_id, schedule_id, canal, message, statut, sent_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [enrollment_id, schedule_id || null, canal, message, statut || 'ENVOYE', sent_by]
  );
  return result.insertId;
}

async function listReminders({ page, parPage, offset, enrollmentId }) {
  const parametres = [];
  let where = '1=1';
  if (enrollmentId) { parametres.push(Number(enrollmentId)); where += ' AND r.enrollment_id = ?'; }
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM payment_reminders r WHERE ${where}`, parametres);
  const [rows] = await pool.query(
    `SELECT r.id, r.canal, r.message, r.statut, r.sent_at,
            s.nom, s.prenom, s.matricule
       FROM payment_reminders r
       JOIN enrollments e ON e.id = r.enrollment_id
       JOIN students s ON s.id = e.student_id
      WHERE ${where}
      ORDER BY r.sent_at DESC LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );
  return { rows, total, page, parPage };
}

module.exports = {
  create, findById, existsInscriptionValide, listByEnrollment, setJustificatif, setStatutAnnule, reverseAllocations,
  insertAllocation, totalEncaisse, totalEncaisseParMoyen, encaissementsParJour, rapportParClasse,
  insertReminder, listReminders,
};
