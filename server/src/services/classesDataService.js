// Données calculées d'un alias pour une période : élèves, notes,
// moyennes, rangs (matière et général), résultats de chaque trimestre de
// l'année, moyenne de la classe, assiduité (absences justifiées / non).
// PARTAGÉ entre bulletins (PDF) et l'espace Parent (JSON).
const pool = require('../config/db');
const yearRepo = require('../repositories/academicYearRepository');
const periodRepo = require('../repositories/evaluationPeriodRepository');
const { moyenneMatiere, moyenneGenerale } = require('./moyenneService');
const { ApiError } = require('../utils/ApiError');

const INTERVAL = (n) => Array.from({ length: n }, () => '?').join(',');

/** Rang façon compétition (1, 1, 3…) sur les valeurs non nulles. */
function rangsCompetition(entrees) {
  // entrees: [{ cle, valeur }] — valeur null/undefined = non classé
  const classes = entrees.filter((e) => e.valeur !== null && e.valeur !== undefined && Number.isFinite(e.valeur))
    .sort((a, b) => b.valeur - a.valeur);
  const rangs = new Map();
  let position = 0;
  let precedent = null;
  classes.forEach((entree, index) => {
    if (precedent === null || entree.valeur < precedent) {
      position = index + 1;
      precedent = entree.valeur;
    }
    rangs.set(entree.cle, position);
  });
  return rangs;
}

const arrondir2 = (v) => (v === null || v === undefined ? null : Math.round((v + Number.EPSILON) * 100) / 100);

async function collecterDonneesAlias({ academicYearId, classAliasId, periodeId }) {
  const [[aliasInfo]] = await pool.query(
    `SELECT a.id AS class_alias_id, a.nom AS alias_nom, cl.id AS class_id, cl.nom AS classe_nom, cy.nom AS cycle_nom
       FROM class_aliases a JOIN classes cl ON cl.id = a.class_id JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE a.id = ?`,
    [classAliasId]
  );
  if (!aliasInfo) throw ApiError.notFound('Alias introuvable.');

  const periode = await periodRepo.findById(periodeId);
  if (!periode) throw ApiError.notFound('Période introuvable.');
  const annee = await yearRepo.findById(academicYearId);

  const [periodesAnnee] = await pool.query(
    'SELECT id, libelle, ordre, date_debut, date_fin FROM evaluation_periods WHERE academic_year_id = ? ORDER BY ordre',
    [academicYearId]
  );

  const [enrollments] = await pool.query(
    `SELECT e.id AS enrollment_id, s.matricule, s.nom, s.prenom, s.sexe, s.date_naissance, s.lieu_naissance, s.photo_path
       FROM enrollments e JOIN students s ON s.id = e.student_id
      WHERE e.class_alias_id = ? AND e.academic_year_id = ? AND e.statut <> 'ANNULE'
      ORDER BY s.nom, s.prenom`,
    [classAliasId, academicYearId]
  );

  const [matieresRaw] = await pool.query(
    `SELECT cs.id AS class_subject_id, s.nom AS matiere, cs.coefficient
       FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id
      WHERE cs.class_id = ? ORDER BY s.nom`,
    [aliasInfo.class_id]
  );

  const enrollmentIds = enrollments.map((e) => e.enrollment_id);

  // --- Notes de TOUTE l'année (tous les trimestres), une seule requête ---
  // notesParEleve[enrollment_id] -> period_id -> class_subject_id -> note
  const notesParEleve = new Map();
  if (enrollmentIds.length > 0) {
    const [grades] = await pool.query(
      `SELECT g.enrollment_id, g.evaluation_period_id, g.class_subject_id, g.interro, g.devoir, g.compo, g.appreciation
         FROM grades g
         JOIN evaluation_periods p ON p.id = g.evaluation_period_id AND p.academic_year_id = ?
        WHERE g.enrollment_id IN (${INTERVAL(enrollmentIds.length)})`,
      [academicYearId, ...enrollmentIds]
    );
    for (const g of grades) {
      if (!notesParEleve.has(g.enrollment_id)) notesParEleve.set(g.enrollment_id, new Map());
      const parPeriode = notesParEleve.get(g.enrollment_id);
      if (!parPeriode.has(g.evaluation_period_id)) parPeriode.set(g.evaluation_period_id, new Map());
      parPeriode.get(g.evaluation_period_id).set(g.class_subject_id, g);
    }
  }

  // --- Assiduité de la période demandée (absences justifiées / non) ---
  const absencesParEleve = new Map();
  if (enrollmentIds.length > 0) {
    const [records] = await pool.query(
      `SELECT ar.enrollment_id, ar.statut,
              SUM(ar.statut = 'ABSENT') AS nb_absents,
              SUM(ar.statut = 'ABSENT' AND ar.justification_statut = 'JUSTIFIEE') AS nb_justifiees,
              SUM(ar.statut = 'ABSENT' AND ar.justification_statut <> 'JUSTIFIEE') AS nb_non_justifiees,
              SUM(ar.statut = 'RETARD') AS nb_retards,
              COALESCE(SUM(ar.minutes_retard), 0) AS minutes
         FROM attendance_records ar
         JOIN attendance_sessions ats ON ats.id = ar.session_id
        WHERE ats.date_cours BETWEEN ? AND ? AND ar.statut IN ('ABSENT','RETARD') AND ar.enrollment_id IN (${INTERVAL(enrollmentIds.length)})
        GROUP BY ar.enrollment_id, ar.statut`,
      [periode.date_debut, periode.date_fin, ...enrollmentIds]
    );
    // Les lignes sont groupées par (élève, statut) : on fusionne.
    for (const r of records) {
      if (!absencesParEleve.has(r.enrollment_id)) {
        absencesParEleve.set(r.enrollment_id, { absences: 0, absencesJustifiees: 0, absencesNonJustifiees: 0, retards: 0, retardMinutes: 0 });
      }
      const agg = absencesParEleve.get(r.enrollment_id);
      agg.absences += Number(r.nb_absents);
      agg.absencesJustifiees += Number(r.nb_justifiees);
      agg.absencesNonJustifiees += Number(r.nb_non_justifiees);
      agg.retards += Number(r.nb_retards);
      agg.retardMinutes += Number(r.minutes);
    }
  }

  // --- Lignes de notes par élève et par période (toutes les périodes) ---
  const lignesParElevePeriode = new Map(); // enrollment_id -> period_id -> lignes[]
  const moyenneParElevePeriode = new Map(); // enrollment_id -> period_id -> number|null
  for (const e of enrollments) {
    const parPeriode = new Map();
    const moyennes = new Map();
    const notesEleve = notesParEleve.get(e.enrollment_id) || new Map();
    for (const p of periodesAnnee) {
      const notesPeriode = notesEleve.get(p.id) || new Map();
      const lignes = matieresRaw.map((m) => {
        const note = notesPeriode.get(m.class_subject_id);
        const moyenne = moyenneMatiere(note || {});
        return {
          class_subject_id: m.class_subject_id,
          matiere: m.matiere,
          coefficient: Number(m.coefficient),
          interro: note?.interro != null ? Number(note.interro) : null,
          devoir: note?.devoir != null ? Number(note.devoir) : null,
          compo: note?.compo != null ? Number(note.compo) : null,
          appreciation: note?.appreciation || null,
          moyenne,
        };
      });
      parPeriode.set(p.id, lignes);
      moyennes.set(p.id, moyenneGenerale(lignes.map((l) => ({ moyenne: l.moyenne, coefficient: l.coefficient }))));
    }
    lignesParElevePeriode.set(e.enrollment_id, parPeriode);
    moyenneParElevePeriode.set(e.enrollment_id, moyennes);
  }

  // --- Rangs généraux par période (compétition, ex æquo partagent le rang) ---
  const rangsGenerauxParPeriode = new Map(); // period_id -> Map(enrollment_id -> rang)
  for (const p of periodesAnnee) {
    rangsGenerauxParPeriode.set(
      p.id,
      rangsCompetition(enrollments.map((e) => ({ cle: e.enrollment_id, valeur: moyenneParElevePeriode.get(e.enrollment_id).get(p.id) })))
    );
  }

  // --- Rang par matière pour la période demandée ---
  const rangsMatiere = new Map(); // class_subject_id -> Map(enrollment_id -> rang)
  for (const m of matieresRaw) {
    rangsMatiere.set(
      m.class_subject_id,
      rangsCompetition(enrollments.map((e) => {
        const lignes = lignesParElevePeriode.get(e.enrollment_id).get(periodeId) || [];
        const ligne = lignes.find((l) => l.class_subject_id === m.class_subject_id);
        return { cle: e.enrollment_id, valeur: ligne ? ligne.moyenne : null };
      }))
    );
  }

  // --- Élèves calculés (période demandée) ---
  const elevesCalcules = enrollments.map((e) => {
    const lignes = (lignesParElevePeriode.get(e.enrollment_id).get(periodeId) || []).map((l) => ({
      ...l,
      rang: rangsMatiere.get(l.class_subject_id)?.get(e.enrollment_id) ?? null,
    }));
    const moyenneGeneraleEleve = moyenneParElevePeriode.get(e.enrollment_id).get(periodeId) ?? null;
    const assiduite = absencesParEleve.get(e.enrollment_id) || { absences: 0, absencesJustifiees: 0, absencesNonJustifiees: 0, retards: 0, retardMinutes: 0 };
    const resultatsAnnee = periodesAnnee.map((p) => ({
      periodeId: p.id,
      libelle: p.libelle,
      ordre: p.ordre,
      moyenne: arrondir2(moyenneParElevePeriode.get(e.enrollment_id).get(p.id)),
      rang: rangsGenerauxParPeriode.get(p.id).get(e.enrollment_id) ?? null,
    }));
    return {
      ...e,
      matieres: lignes,
      moyenneGenerale: moyenneGeneraleEleve,
      rang: rangsGenerauxParPeriode.get(periodeId).get(e.enrollment_id) ?? null,
      resultatsAnnee,
      ...assiduite,
    };
  });

  // --- Stats de classe (période demandée) ---
  const moyennes = elevesCalcules.map((e) => e.moyenneGenerale).filter((v) => v !== null);
  const effectif = elevesCalcules.length;
  const nbAvecMoyenne = moyennes.length;
  const nbAdmis = moyennes.filter((m) => m >= 10).length;
  const moyenneClasse = nbAvecMoyenne > 0
    ? arrondir2(moyennes.reduce((acc, v) => acc + v, 0) / nbAvecMoyenne)
    : null;
  const statsClasse = {
    nbAvecMoyenne,
    nbAdmis,
    pctReussite: nbAvecMoyenne > 0 ? Math.round((nbAdmis / nbAvecMoyenne) * 1000) / 10 : 0,
    moyenneClasse,
    moyenneMax: nbAvecMoyenne > 0 ? arrondir2(Math.max(...moyennes)) : null,
    moyenneMin: nbAvecMoyenne > 0 ? arrondir2(Math.min(...moyennes)) : null,
  };

  return {
    aliasInfo,
    periode,
    annee,
    periodesAnnee,
    eleves: elevesCalcules,
    moyenneClasse,
    effectif,
    statsClasse,
  };
}

module.exports = { collecterDonneesAlias };
