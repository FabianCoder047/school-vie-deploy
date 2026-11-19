// Statistiques de présences — agrégats pour le directeur et la secrétaire,
// et liste par élève pour le professeur.
// Une « absence » = un enregistrement ABSENT (justifiée ou non) ;
// un « retard » = un enregistrement RETARD.
const pool = require('../config/db');
const { ApiError } = require('../utils/ApiError');

const INTERVAL = (n) => Array.from({ length: n }, () => '?').join(',');

async function periodesDeLAnnee(academicYearId) {
  const [periodes] = await pool.query(
    'SELECT id, libelle, ordre, date_debut, date_fin FROM evaluation_periods WHERE academic_year_id = ? ORDER BY ordre',
    [academicYearId]
  );
  return periodes;
}

/** Période par défaut : celle dont la date du jour est incluse, sinon la 1re. */
async function periodeParDefaut(academicYearId) {
  const [[p]] = await pool.query(
    `SELECT id, libelle, ordre, date_debut, date_fin FROM evaluation_periods
      WHERE academic_year_id = ? AND date_debut <= CURDATE() AND date_fin >= CURDATE()
      ORDER BY ordre LIMIT 1`,
    [academicYearId]
  );
  if (p) return p;
  const [periodes] = await pool.query(
    'SELECT id, libelle, ordre, date_debut, date_fin FROM evaluation_periods WHERE academic_year_id = ? ORDER BY ordre LIMIT 1',
    [academicYearId]
  );
  return periodes[0] || null;
}

async function bornesAnnee(academicYearId) {
  const [[annee]] = await pool.query('SELECT date_debut, date_fin FROM academic_years WHERE id = ?', [academicYearId]);
  if (!annee) throw ApiError.notFound('Année académique introuvable.', 'ANNEE_INTROUVABLE');
  return annee;
}

const somme = (obj, cle, defaut = 0) => Number(obj?.[cle] ?? defaut);

/**
 * Statistiques globales de l'école (année courante).
 * periodeId null → toute l'année ; aliasId → filtre sur un alias.
 */
async function statistiquesPresences({ academicYearId, periodeId = null, aliasId = null }) {
  const periodes = await periodesDeLAnnee(academicYearId);
  let periode = null;
  let dateDebut;
  let dateFin;
  if (periodeId) {
    periode = periodes.find((p) => Number(p.id) === Number(periodeId));
    if (!periode) throw ApiError.badRequest('Période introuvable pour cette année.', 'PERIODE_INVALIDE');
    dateDebut = periode.date_debut;
    dateFin = periode.date_fin;
  } else {
    ({ date_debut: dateDebut, date_fin: dateFin } = await bornesAnnee(academicYearId));
  }
  const aliasFiltre = aliasId ? Number(aliasId) : null;
  const filtreAlias = aliasFiltre ? 'AND ta.class_alias_id = ?' : '';
  const paramsCommuns = aliasFiltre ? [dateDebut, dateFin, aliasFiltre] : [dateDebut, dateFin];

  // --- Séances par alias (pour le taux d'absentéisme) ---
  const [seancesParAlias] = await pool.query(
    `SELECT ta.class_alias_id, COUNT(DISTINCT ats.id) AS seances
       FROM attendance_sessions ats
       JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
      WHERE ats.date_cours BETWEEN ? AND ? AND ta.academic_year_id = ? ${aliasFiltre ? 'AND ta.class_alias_id = ?' : ''}
      GROUP BY ta.class_alias_id`,
    aliasFiltre ? [dateDebut, dateFin, academicYearId, aliasFiltre] : [dateDebut, dateFin, academicYearId]
  );

  // --- Effectifs par alias ---
  const [effectifs] = await pool.query(
    `SELECT class_alias_id, COUNT(*) AS effectif
       FROM enrollments
      WHERE academic_year_id = ? AND statut <> 'ANNULE' ${aliasFiltre ? 'AND class_alias_id = ?' : ''}
      GROUP BY class_alias_id`,
    aliasFiltre ? [academicYearId, aliasFiltre] : [academicYearId]
  );

  // --- Absences/retards par alias ---
  const [compteurs] = await pool.query(
    `SELECT ta.class_alias_id,
            SUM(ar.statut = 'ABSENT') AS absences,
            SUM(ar.statut = 'ABSENT' AND ar.justification_statut = 'JUSTIFIEE') AS justifiees,
            SUM(ar.statut = 'ABSENT' AND ar.justification_statut <> 'JUSTIFIEE') AS non_justifiees,
            SUM(ar.statut = 'RETARD') AS retards,
            COALESCE(SUM(ar.minutes_retard), 0) AS retard_minutes
       FROM attendance_records ar
       JOIN attendance_sessions ats ON ats.id = ar.session_id
       JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
      WHERE ats.date_cours BETWEEN ? AND ? AND ta.academic_year_id = ? ${aliasFiltre ? 'AND ta.class_alias_id = ?' : ''}
      GROUP BY ta.class_alias_id`,
    aliasFiltre ? [dateDebut, dateFin, academicYearId, aliasFiltre] : [dateDebut, dateFin, academicYearId]
  );

  // --- Tous les alias de l'année (même sans appel saisi) ---
  const [aliases] = await pool.query(
    `SELECT a.id AS class_alias_id, a.nom AS alias_nom, cl.nom AS classe_nom, cy.nom AS cycle_nom
       FROM class_aliases a
       JOIN classes cl ON cl.id = a.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE EXISTS (SELECT 1 FROM enrollments e WHERE e.class_alias_id = a.id AND e.academic_year_id = ? AND e.statut <> 'ANNULE')
        ${aliasFiltre ? 'AND a.id = ?' : ''}
      ORDER BY cy.ordre, cl.ordre, a.nom`,
    aliasFiltre ? [academicYearId, aliasFiltre] : [academicYearId]
  );

  const seancesMap = new Map(seancesParAlias.map((r) => [Number(r.class_alias_id), Number(r.seances)]));
  const effectifMap = new Map(effectifs.map((r) => [Number(r.class_alias_id), Number(r.effectif)]));
  const compteursMap = new Map(compteurs.map((r) => [Number(r.class_alias_id), r]));

  const parAlias = aliases.map((a) => {
    const c = compteursMap.get(Number(a.class_alias_id));
    const effectif = effectifMap.get(Number(a.class_alias_id)) || 0;
    const seances = seancesMap.get(Number(a.class_alias_id)) || 0;
    const absences = somme(c, 'absences');
    return {
      class_alias_id: Number(a.class_alias_id),
      alias_nom: a.alias_nom,
      classe_nom: a.classe_nom,
      cycle_nom: a.cycle_nom,
      effectif,
      seances,
      absences,
      justifiees: somme(c, 'justifiees'),
      nonJustifiees: somme(c, 'non_justifiees'),
      retards: somme(c, 'retards'),
      retardMinutes: somme(c, 'retard_minutes'),
      tauxAbsence: effectif > 0 && seances > 0 ? Math.round((absences / (effectif * seances)) * 1000) / 10 : 0,
    };
  });

  // --- Évolution par période (année entière, non filtrée par alias ni période) ---
  const [parPeriode] = await pool.query(
    `SELECT p.id AS periodeId, p.libelle, p.ordre,
            COALESCE(SUM(ar.statut = 'ABSENT'), 0) AS absences,
            COALESCE(SUM(ar.statut = 'ABSENT' AND ar.justification_statut = 'JUSTIFIEE'), 0) AS justifiees,
            COALESCE(SUM(ar.statut = 'ABSENT' AND ar.justification_statut <> 'JUSTIFIEE'), 0) AS nonJustifiees,
            COALESCE(SUM(ar.statut = 'RETARD'), 0) AS retards
       FROM evaluation_periods p
       LEFT JOIN attendance_sessions ats ON ats.date_cours BETWEEN p.date_debut AND p.date_fin
       LEFT JOIN attendance_records ar ON ar.session_id = ats.id AND ar.statut IN ('ABSENT','RETARD')
      WHERE p.academic_year_id = ?
      GROUP BY p.id, p.libelle, p.ordre
      ORDER BY p.ordre`,
    [academicYearId]
  );

  // --- Élèves avec au moins une absence/retard sur la période ---
  const [parEleve] = await pool.query(
    `SELECT e.id AS enrollment_id, s.matricule, s.nom, s.prenom,
            a.nom AS alias_nom, cl.nom AS classe_nom,
            SUM(ar.statut = 'ABSENT') AS absences,
            SUM(ar.statut = 'ABSENT' AND ar.justification_statut = 'JUSTIFIEE') AS justifiees,
            SUM(ar.statut = 'ABSENT' AND ar.justification_statut <> 'JUSTIFIEE') AS nonJustifiees,
            SUM(ar.statut = 'RETARD') AS retards,
            COALESCE(SUM(ar.minutes_retard), 0) AS retardMinutes
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_aliases a ON a.id = e.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
       JOIN attendance_records ar ON ar.enrollment_id = e.id AND ar.statut IN ('ABSENT','RETARD')
       JOIN attendance_sessions ats ON ats.id = ar.session_id AND ats.date_cours BETWEEN ? AND ?
      WHERE e.academic_year_id = ? AND e.statut <> 'ANNULE' ${aliasFiltre ? 'AND e.class_alias_id = ?' : ''}
      GROUP BY e.id, s.matricule, s.nom, s.prenom, a.nom, cl.nom
      ORDER BY absences DESC, retards DESC, s.nom, s.prenom`,
    aliasFiltre ? [dateDebut, dateFin, academicYearId, aliasFiltre] : [dateDebut, dateFin, academicYearId]
  );

  const totaux = parAlias.reduce(
    (acc, a) => ({
      absences: acc.absences + a.absences,
      justifiees: acc.justifiees + a.justifiees,
      nonJustifiees: acc.nonJustifiees + a.nonJustifiees,
      retards: acc.retards + a.retards,
      retardMinutes: acc.retardMinutes + a.retardMinutes,
      seances: acc.seances + a.seances,
      places: acc.places + a.effectif * a.seances,
    }),
    { absences: 0, justifiees: 0, nonJustifiees: 0, retards: 0, retardMinutes: 0, seances: 0, places: 0 }
  );

  return {
    periode, // null = toute l'année
    periodes,
    aliasFiltre,
    totaux: {
      ...totaux,
      tauxJustification: totaux.absences > 0 ? Math.round((totaux.justifiees / totaux.absences) * 1000) / 10 : 0,
      tauxAbsence: totaux.places > 0 ? Math.round((totaux.absences / totaux.places) * 1000) / 10 : 0,
    },
    parAlias,
    parPeriode: parPeriode.map((p) => ({
      periodeId: Number(p.periodeId),
      libelle: p.libelle,
      ordre: p.ordre,
      absences: somme(p, 'absences'),
      justifiees: somme(p, 'justifiees'),
      nonJustifiees: somme(p, 'nonJustifiees'),
      retards: somme(p, 'retards'),
    })),
    parEleve,
  };
}

/** Élèves des alias enseignés par le professeur (année courante) + compteurs. */
async function elevesAbsencesProfesseur(teacherId, academicYearId, periodeId = null) {
  const [aliasRows] = await pool.query(
    `SELECT DISTINCT a.id AS class_alias_id, a.nom AS alias_nom, cl.nom AS classe_nom
       FROM teacher_assignments ta
       JOIN class_aliases a ON a.id = ta.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
      WHERE ta.teacher_id = ? AND ta.academic_year_id = ?
      ORDER BY a.nom`,
    [teacherId, academicYearId]
  );
  const periodes = await periodesDeLAnnee(academicYearId);
  if (aliasRows.length === 0) return { periodes, alias: [], eleves: [] };

  let periode = null;
  let dateDebut;
  let dateFin;
  if (periodeId) {
    periode = periodes.find((p) => Number(p.id) === Number(periodeId));
    if (!periode) throw ApiError.badRequest('Période introuvable pour cette année.', 'PERIODE_INVALIDE');
    dateDebut = periode.date_debut;
    dateFin = periode.date_fin;
  } else {
    ({ date_debut: dateDebut, date_fin: dateFin } = await bornesAnnee(academicYearId));
  }

  const aliasIds = aliasRows.map((r) => Number(r.class_alias_id));
  const [eleves] = await pool.query(
    `SELECT e.id AS enrollment_id, s.matricule, s.nom, s.prenom,
            a.nom AS alias_nom, cl.nom AS classe_nom,
            COALESCE(SUM(ar.statut = 'ABSENT'), 0) AS absences,
            COALESCE(SUM(ar.statut = 'ABSENT' AND ar.justification_statut = 'JUSTIFIEE'), 0) AS justifiees,
            COALESCE(SUM(ar.statut = 'ABSENT' AND ar.justification_statut <> 'JUSTIFIEE'), 0) AS nonJustifiees,
            COALESCE(SUM(ar.statut = 'RETARD'), 0) AS retards,
            COALESCE(SUM(ar.minutes_retard), 0) AS retardMinutes
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_aliases a ON a.id = e.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
       LEFT JOIN (
         SELECT ar.enrollment_id, ar.statut, ar.minutes_retard, ar.justification_statut
           FROM attendance_records ar
           JOIN attendance_sessions ats ON ats.id = ar.session_id AND ats.date_cours BETWEEN ? AND ?
          WHERE ar.statut IN ('ABSENT','RETARD')
       ) ar ON ar.enrollment_id = e.id
      WHERE e.class_alias_id IN (${INTERVAL(aliasIds.length)}) AND e.academic_year_id = ? AND e.statut <> 'ANNULE'
      GROUP BY e.id, s.matricule, s.nom, s.prenom, a.nom, cl.nom
      ORDER BY a.nom, s.nom, s.prenom`,
    [dateDebut, dateFin, ...aliasIds, academicYearId]
  );

  return {
    periodes,
    periode,
    alias: aliasRows,
    eleves: eleves.map((e) => ({
      ...e,
      absences: somme(e, 'absences'),
      justifiees: somme(e, 'justifiees'),
      nonJustifiees: somme(e, 'nonJustifiees'),
      retards: somme(e, 'retards'),
      retardMinutes: somme(e, 'retardMinutes'),
    })),
  };
}

module.exports = { statistiquesPresences, elevesAbsencesProfesseur, periodesDeLAnnee, periodeParDefaut };
