// =====================================================================
// Saisie des notes (PROFESSEUR) : accès limité à SES classes/matières,
// fenêtre de saisie stricte (saisie_debut ≤ NOW() ≤ saisie_fin),
// notes 0–20. Écritures groupées en transaction (tout ou rien).
// =====================================================================
const pool = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const yearRepo = require('../repositories/academicYearRepository');
const periodRepo = require('../repositories/evaluationPeriodRepository');
const gradeRepo = require('../repositories/gradeRepository');
const { log: audit } = require('../repositories/auditRepository');
const { moyenneMatiere, moyenneGenerale } = require('./moyenneService');

/** Affectation du prof pour (alias, class_subject, année) — sinon 403. */
async function assertProfesseurAffecte({ teacherId, classAliasId, classSubjectId, academicYearId }) {
  const [[row]] = await pool.query(
    `SELECT ta.id
       FROM teacher_assignments ta
      WHERE ta.academic_year_id = ? AND ta.teacher_id = ? AND ta.class_alias_id = ? AND ta.class_subject_id = ?`,
    [academicYearId, teacherId, classAliasId, classSubjectId]
  );
  if (!row) {
    throw ApiError.forbidden('Vous n’êtes pas affecté à cette matière dans cette classe/alias.', 'NON_AFFECTE');
  }
  return row.id;
}

/** Classes/alias que le professeur enseigne (écran d'accueil). */
async function mesClasses(teacherId) {
  const courante = await yearRepo.findCurrent();
  if (!courante) return { annee: null, classes: [] };
  const [rows] = await pool.query(
    `SELECT a.id AS alias_id, a.nom AS alias_nom, cl.nom AS classe_nom, cy.nom AS cycle_nom,
            s.id AS subject_id, s.nom AS matiere_nom, cs.id AS class_subject_id, cs.coefficient,
            (SELECT COUNT(*) FROM enrollments e WHERE e.class_alias_id = a.id AND e.academic_year_id = ? AND e.statut <> 'ANNULE') AS effectif
       FROM teacher_assignments ta
       JOIN class_aliases a ON a.id = ta.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id
       JOIN class_subjects cs ON cs.id = ta.class_subject_id
       JOIN subjects s ON s.id = cs.subject_id
      WHERE ta.teacher_id = ? AND ta.academic_year_id = ?
      ORDER BY cy.ordre, cl.ordre, a.nom, s.nom`,
    [courante.id, teacherId, courante.id]
  );
  return { annee: courante, classes: rows };
}

/** Feuille de notes : élèves + notes existantes + licence d'écriture. */
async function feuille({ teacherId, classAliasId, classSubjectId, evaluationPeriodId }) {
  const courante = await yearRepo.findCurrent();
  if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
  await assertProfesseurAffecte({ teacherId, classAliasId, classSubjectId, academicYearId: courante.id });

  const periode = await periodRepo.findById(evaluationPeriodId);
  if (!periode) throw ApiError.notFound('Période introuvable.');
  const fenetre = periodRepo.fenetreSaisie(periode);

  const rows = await gradeRepo.listSheet({ classAliasId, classSubjectId, evaluationPeriodId, academicYearId: courante.id });
  const lignes = rows.map((r) => ({
    enrollment_id: r.enrollment_id,
    matricule: r.matricule,
    nom: r.nom,
    prenom: r.prenom,
    photo_path: r.photo_path,
    interro: r.interro !== null ? Number(r.interro) : null,
    devoir: r.devoir !== null ? Number(r.devoir) : null,
    compo: r.compo !== null ? Number(r.compo) : null,
    moyenne: moyenneMatiere(r),
  }));
  return {
    annee: courante,
    periode: { ...periode, fenetre },
    lignes,
    modifiable: fenetre.ouverte,
  };
}

/**
 * Enregistre la feuille : upsert de chaque ligne fournie pour (alias, matière, période).
 * Rejette toute écriture hors fenêtre et tout élève étranger à l'alias.
 */
async function enregistrerFeuille({ teacherId, classAliasId, classSubjectId, evaluationPeriodId, notes }, actorId, ip) {
  const courante = await yearRepo.findCurrent();
  if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
  await assertProfesseurAffecte({ teacherId, classAliasId, classSubjectId, academicYearId: courante.id });

  const periode = await periodRepo.findById(evaluationPeriodId);
  if (!periode) throw ApiError.notFound('Période introuvable.');
  const fenetre = periodRepo.fenetreSaisie(periode);
  if (!fenetre.ouverte) {
    throw ApiError.forbidden(`La saisie des notes est fermée. ${fenetre.motif}`, 'SAISIE_FERMEE');
  }

  // Élèves autorisés : ceux inscrits dans cet alias pour l'année.
  const [rows] = await pool.query(
    "SELECT id FROM enrollments WHERE class_alias_id = ? AND academic_year_id = ? AND statut <> 'ANNULE'",
    [classAliasId, courante.id]
  );
  const autorises = new Set(rows.map((r) => r.id));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const ligne of notes) {
      if (!autorises.has(ligne.enrollment_id)) {
        throw ApiError.badRequest('Un élève de la feuille n’appartient pas à cette classe/alias.', 'ELEVE_HORS_ALIAS');
      }
      const vals = ['interro', 'devoir', 'compo'].map((k) => (ligne[k] === '' || ligne[k] === undefined ? null : Number(ligne[k])));
      if (vals.some((n) => n !== null && (Number.isNaN(n) || n < 0 || n > 20))) {
        throw ApiError.badRequest('Chaque note doit être entre 0 et 20.', 'NOTE_HORS_BORNES');
      }
      // eslint-disable-next-line no-await-in-loop
      await gradeRepo.upsertGrade(
        {
          enrollment_id: ligne.enrollment_id,
          class_subject_id: classSubjectId,
          evaluation_period_id: evaluationPeriodId,
          interro: vals[0]?.toFixed(2) ?? null,
          devoir: vals[1]?.toFixed(2) ?? null,
          compo: vals[2]?.toFixed(2) ?? null,
          appreciation: null, // calcul automatique (moyenne de matière) — non modifiable
          entered_by: teacherId,
        },
        conn
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await audit({
    userId: teacherId,
    action: 'UPSERT_GRADES',
    entity: 'grades',
    entityId: classSubjectId,
    newValues: { classAliasId, evaluationPeriodId, nb: notes.length },
    ipAddress: ip,
  });
  return feuille({ teacherId, classAliasId, classSubjectId, evaluationPeriodId });
}

module.exports = { mesClasses, feuille, enregistrerFeuille, assertProfesseurAffecte };
