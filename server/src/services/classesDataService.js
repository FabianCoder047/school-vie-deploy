// Données calculées d'un alias pour une période : élèves, notes,
// moyennes, rang dans la classe, moyenne de classe, assiduité.
// PARTAGÉ entre bulletins (PDF) et l'espace Parent (JSON).
const pool = require('../config/db');
const yearRepo = require('../repositories/academicYearRepository');
const periodRepo = require('../repositories/evaluationPeriodRepository');
const { moyenneMatiere, moyenneGenerale } = require('./moyenneService');
const { ApiError } = require('../utils/ApiError');

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

  const [enrollments] = await pool.query(
    `SELECT e.id AS enrollment_id, s.matricule, s.nom, s.prenom, s.date_naissance, s.lieu_naissance, s.photo_path
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
  const notesParEleve = new Map();
  if (enrollmentIds.length > 0) {
    const placeholders = enrollmentIds.map(() => '?').join(',');
    const [grades] = await pool.query(
      `SELECT enrollment_id, class_subject_id, interro, devoir, compo, appreciation
         FROM grades WHERE evaluation_period_id = ? AND enrollment_id IN (${placeholders})`,
      [periodeId, ...enrollmentIds]
    );
    for (const g of grades) {
      if (!notesParEleve.has(g.enrollment_id)) notesParEleve.set(g.enrollment_id, new Map());
      notesParEleve.get(g.enrollment_id).set(g.class_subject_id, g);
    }
  }

  const absencesParEleve = new Map();
  if (enrollmentIds.length > 0) {
    const placeholders = enrollmentIds.map(() => '?').join(',');
    const [records] = await pool.query(
      `SELECT ar.enrollment_id, ar.statut, COUNT(*) AS nb, COALESCE(SUM(ar.minutes_retard), 0) AS minutes
         FROM attendance_records ar
         JOIN attendance_sessions ats ON ats.id = ar.session_id
        WHERE ats.date_cours BETWEEN ? AND ? AND ar.statut IN ('ABSENT','RETARD') AND ar.enrollment_id IN (${placeholders})
        GROUP BY ar.enrollment_id, ar.statut`,
      [periode.date_debut, periode.date_fin, ...enrollmentIds]
    );
    for (const r of records) {
      if (!absencesParEleve.has(r.enrollment_id)) absencesParEleve.set(r.enrollment_id, { absences: 0, retards: 0, retardMinutes: 0 });
      const agg = absencesParEleve.get(r.enrollment_id);
      if (r.statut === 'ABSENT') agg.absences = Number(r.nb);
      else { agg.retards = Number(r.nb); agg.retardMinutes = Number(r.minutes); }
    }
  }

  const elevesCalcules = enrollments.map((e) => {
    const notes = notesParEleve.get(e.enrollment_id) || new Map();
    const lignes = matieresRaw.map((m) => {
      const note = notes.get(m.class_subject_id);
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
    const moyenneGeneraleEleve = moyenneGenerale(lignes.map((l) => ({ moyenne: l.moyenne, coefficient: l.coefficient })));
    const assiduite = absencesParEleve.get(e.enrollment_id) || { absences: 0, retards: 0, retardMinutes: 0 };
    return { ...e, matieres: lignes, moyenneGenerale: moyenneGeneraleEleve, ...assiduite };
  });

  const avecMoyenne = elevesCalcules.filter((e) => e.moyenneGenerale !== null).sort((a, b) => b.moyenneGenerale - a.moyenneGenerale);
  const effectif = elevesCalcules.length;
  let position = 0;
  let rangPrecedent = null;
  avecMoyenne.forEach((e, index) => {
    if (rangPrecedent === null || e.moyenneGenerale < rangPrecedent) {
      position = index + 1;
      rangPrecedent = e.moyenneGenerale;
    }
    e.rang = position;
  });
  const moyenneClasse = avecMoyenne.length > 0
    ? Math.round((avecMoyenne.reduce((acc, e) => acc + e.moyenneGenerale, 0) / avecMoyenne.length + Number.EPSILON) * 100) / 100
    : null;

  return { aliasInfo, periode, annee, eleves: elevesCalcules, moyenneClasse, effectif };
}

module.exports = { collecterDonneesAlias };
