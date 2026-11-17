// KPI des tableaux de bord Admin et Directeur.
const pool = require('../config/db');

async function countTable(table, where = '1=1', params = []) {
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, params);
  return n;
}

async function dashboardAdmin() {
  const [[annee]] = await pool.query('SELECT id, libelle FROM academic_years WHERE is_current = 1 LIMIT 1');
  const anneeId = annee?.id;
  const [cycles, classes, matieres, directeurs, parents, professeurs, eleves, tauxRecouvrement] = await Promise.all([
    countTable('cycles'),
    countTable('classes'),
    countTable('subjects'),
    countTable('users', "role = 'DIRECTEUR'"),
    countTable('users', "role = 'PARENT'"),
    countTable('users', "role = 'PROFESSEUR'"),
    anneeId ? countTable('enrollments', "academic_year_id = ? AND statut <> 'ANNULE'", [anneeId]) : Promise.resolve(0),
    anneeId ? (async () => {
      const [[{ attendu }]] = await pool.query(
        "SELECT COALESCE(SUM(montant_scolarite),0) AS attendu FROM enrollments WHERE academic_year_id = ? AND statut <> 'ANNULE'",
        [anneeId]
      );
      const [[{ encaisse }]] = await pool.query(
        "SELECT COALESCE(SUM(p.montant),0) AS encaisse FROM payments p JOIN enrollments e ON e.id = p.enrollment_id WHERE e.academic_year_id = ? AND p.type = 'SCOLARITE' AND p.statut = 'VALIDE'",
        [anneeId]
      );
      const attenduN = Number(attendu);
      return attenduN > 0 ? Math.round((Number(encaisse) / attenduN) * 1000) / 10 : 0;
    })() : Promise.resolve(0),
  ]);
  const [classesParCycle] = await pool.query(
    `SELECT cy.nom AS cycle, COUNT(cl.id) AS classes
       FROM cycles cy LEFT JOIN classes cl ON cl.cycle_id = cy.id
      GROUP BY cy.id, cy.nom, cy.ordre
      ORDER BY cy.ordre, cy.nom`
  );
  return {
    cycles,
    classes,
    matieres,
    directeurs,
    parents,
    professeurs,
    eleves,
    tauxRecouvrement,
    anneeCourante: annee?.libelle || null,
    classesParCycle: classesParCycle.map((r) => ({ cycle: r.cycle, classes: r.classes })),
  };
}

async function dashboardDirecteur() {
  const [[{ secretaires }]] = await pool.query("SELECT COUNT(*) AS secretaires FROM users WHERE role = 'SECRETAIRE' AND is_active = 1");
  const [[{ comptables }]] = await pool.query("SELECT COUNT(*) AS comptables FROM users WHERE role = 'COMPTABLE' AND is_active = 1");
  const [[{ professeurs }]] = await pool.query("SELECT COUNT(*) AS professeurs FROM users WHERE role = 'PROFESSEUR' AND is_active = 1");
  const [classes, alias, affectations] = await Promise.all([
    countTable('classes'),
    countTable('class_aliases'),
    countTable('class_subjects'),
  ]);
  const annee = await pool.query('SELECT id, libelle FROM academic_years WHERE is_current = 1 LIMIT 1');
  const anneeCourante = annee[0]?.length ? annee[0][0] : null;

  // Présence / assiduité du mois + recouvrement (KPIs école, année courante)
  let recouvrement = 0;
  let absencesMois = 0;
  let retardsMois = 0;
  let eleves = 0;
  if (anneeCourante) {
    const [[{ attendu, encaisse }]] = await pool.query(
      `SELECT COALESCE(SUM(e.montant_scolarite),0) AS attendu,
              COALESCE((SELECT SUM(p.montant) FROM payments p JOIN enrollments e2 ON e2.id = p.enrollment_id
                         WHERE e2.academic_year_id = ? AND p.type = 'SCOLARITE' AND p.statut = 'VALIDE'), 0) AS encaisse
         FROM enrollments e WHERE e.academic_year_id = ? AND e.statut <> 'ANNULE'`,
      [anneeCourante.id, anneeCourante.id]
    );
    const attenduN = Number(attendu);
    recouvrement = attenduN > 0 ? Math.round((Number(encaisse) / attenduN) * 1000) / 10 : 0;

    const [[{ abs, ret }]] = await pool.query(
      `SELECT SUM(ar.statut = 'ABSENT') AS abs, SUM(ar.statut = 'RETARD') AS ret
         FROM attendance_records ar
         JOIN attendance_sessions ats ON ats.id = ar.session_id
        WHERE ats.date_cours >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );
    absencesMois = Number(abs || 0);
    retardsMois = Number(ret || 0);
    eleves = await countTable('enrollments', "academic_year_id = ? AND statut <> 'ANNULE'", [anneeCourante.id]);
  }
  return {
    secretaires,
    comptables,
    professeurs,
    classes,
    alias,
    affectations,
    eleves,
    recouvrement,
    absencesMois,
    retardsMois,
    anneeCourante: anneeCourante?.libelle || null,
    utilisateursParRole: [
      { role: 'Secrétaires', total: secretaires },
      { role: 'Comptables', total: comptables },
      { role: 'Professeurs', total: professeurs },
    ],
  };
}

async function dashboardSecretaire() {
  const [[annee]] = await pool.query('SELECT id, libelle FROM academic_years WHERE is_current = 1 LIMIT 1');
  if (!annee) return { anneeCourante: null, inscriptionsDuJour: 0, inscriptionsDuMois: 0, inscriptionsEnAttente: 0, totalEleves: 0, effectifsParCycle: [] };
  const [[{ inscriptionsDuJour }]] = await pool.query(
    'SELECT COUNT(*) AS inscriptionsDuJour FROM enrollments WHERE academic_year_id = ? AND date_inscription = CURDATE() AND statut <> ?',
    [annee.id, 'ANNULE']
  );
  const [[{ inscriptionsDuMois }]] = await pool.query(
    "SELECT COUNT(*) AS inscriptionsDuMois FROM enrollments WHERE academic_year_id = ? AND YEAR(date_inscription) = YEAR(CURDATE()) AND MONTH(date_inscription) = MONTH(CURDATE()) AND statut <> 'ANNULE'",
    [annee.id]
  );
  const [[{ inscriptionsEnAttente }]] = await pool.query(
    "SELECT COUNT(*) AS inscriptionsEnAttente FROM enrollments WHERE academic_year_id = ? AND statut = 'EN_ATTENTE'",
    [annee.id]
  );
  const [[{ totalEleves }]] = await pool.query(
    "SELECT COUNT(*) AS totalEleves FROM enrollments WHERE academic_year_id = ? AND statut <> 'ANNULE'",
    [annee.id]
  );
  const [effectifsParCycle] = await pool.query(
    `SELECT cy.nom AS cycle, COUNT(e.id) AS effectif
       FROM cycles cy
       JOIN classes cl ON cl.cycle_id = cy.id
       JOIN enrollments e ON e.class_id = cl.id AND e.academic_year_id = ? AND e.statut <> 'ANNULE'
      GROUP BY cy.id, cy.nom, cy.ordre ORDER BY cy.ordre, cy.nom`,
    [annee.id]
  );
  return {
    anneeCourante: annee.libelle,
    inscriptionsDuJour,
    inscriptionsEnAttente,
    inscriptionsDuMois,
    totalEleves,
    effectifsParCycle: effectifsParCycle.map((r) => ({ cycle: r.cycle, effectif: r.effectif })),
  };
}

async function dashboardComptable() {
  const [[annee]] = await pool.query('SELECT id, libelle FROM academic_years WHERE is_current = 1 LIMIT 1');
  if (!annee) {
    return { anneeCourante: null, encaisseDuJour: '0', encaisseDuMois: '0', impayes: '0', tauxRecouvrement: 0, evolution: [], parMoyen: [] };
  }
  const [[{ encaisseDuJour }]] = await pool.query(
    "SELECT COALESCE(SUM(p.montant), 0) AS encaisseDuJour FROM payments p JOIN enrollments e ON e.id = p.enrollment_id WHERE p.statut = 'VALIDE' AND p.type = 'SCOLARITE' AND e.academic_year_id = ? AND DATE(p.date_paiement) = CURDATE()",
    [annee.id]
  );
  const [[{ encaisseDuMois }]] = await pool.query(
    "SELECT COALESCE(SUM(p.montant), 0) AS encaisseDuMois FROM payments p JOIN enrollments e ON e.id = p.enrollment_id WHERE p.statut = 'VALIDE' AND p.type = 'SCOLARITE' AND e.academic_year_id = ? AND YEAR(p.date_paiement) = YEAR(CURDATE()) AND MONTH(p.date_paiement) = MONTH(CURDATE())",
    [annee.id]
  );
  const [[{ impayes }]] = await pool.query(
    "SELECT COALESCE(SUM(ps.montant_du - ps.montant_paye), 0) AS impayes FROM payment_schedules ps JOIN enrollments e ON e.id = ps.enrollment_id WHERE e.academic_year_id = ? AND ps.statut <> 'PAYE'",
    [annee.id]
  );
  const [[{ attendu, encaisse }]] = await pool.query(
    `SELECT COALESCE(SUM(e.montant_scolarite), 0) AS attendu,
            COALESCE((SELECT SUM(p.montant) FROM payments p JOIN enrollments e2 ON e2.id = p.enrollment_id
                       WHERE e2.academic_year_id = ? AND p.type = 'SCOLARITE' AND p.statut = 'VALIDE'), 0) AS encaisse
       FROM enrollments e WHERE e.academic_year_id = ? AND e.statut <> 'ANNULE'`,
    [annee.id, annee.id]
  );
  const [evolution] = await pool.query(
    `SELECT DATE(p.date_paiement) AS jour, COALESCE(SUM(p.montant), 0) AS total
       FROM payments p JOIN enrollments e ON e.id = p.enrollment_id
      WHERE p.statut = 'VALIDE' AND p.type = 'SCOLARITE' AND e.academic_year_id = ?
        AND p.date_paiement >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY DATE(p.date_paiement) ORDER BY jour`,
    [annee.id]
  );
  const [parMoyen] = await pool.query(
    "SELECT p.moyen, COALESCE(SUM(p.montant), 0) AS total FROM payments p JOIN enrollments e ON e.id = p.enrollment_id WHERE p.statut = 'VALIDE' AND p.type = 'SCOLARITE' AND e.academic_year_id = ? GROUP BY p.moyen",
    [annee.id]
  );
  const attenduN = Number(attendu);
  return {
    anneeCourante: annee.libelle,
    encaisseDuJour: String(encaisseDuJour),
    encaisseDuMois: String(encaisseDuMois),
    impayes: String(impayes),
    tauxRecouvrement: attenduN > 0 ? Math.round((Number(encaisse) / attenduN) * 1000) / 10 : 0,
    evolution: evolution.map((r) => ({ jour: r.jour, total: Number(r.total) })),
    parMoyen: parMoyen.map((r) => ({ moyen: r.moyen, total: Number(r.total) })),
  };
}

module.exports = { dashboardAdmin, dashboardDirecteur, dashboardSecretaire, dashboardComptable };
