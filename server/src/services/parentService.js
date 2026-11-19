// =====================================================================
// Espace Parent — consultation en LECTURE SEULE des données de SES enfants.
// Un parent ne voit QUE les élèves rattachés à son compte (guardians.user_id).
// =====================================================================
const pool = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const yearRepo = require('../repositories/academicYearRepository');
const { collecterDonneesAlias } = require('./classesDataService');
const { appreciation } = require('./moyenneService');
const timetableService = require('./timetableService');
const paymentService = require('./paymentService');
const notificationRepo = require('../repositories/notificationRepository');
const justificationService = require('./justificationService');

/** Vérifie que l'élève (enrollment) appartient bien à un tuteur du parent connecté. */
async function assertEnfantDuParent(userId, enrollmentId) {
  const [[row]] = await pool.query(
    `SELECT e.id AS enrollment_id, e.student_id, e.class_id, e.class_alias_id, e.academic_year_id, e.statut,
            s.matricule, s.nom, s.prenom, s.photo_path, s.date_naissance, g.user_id AS parent_user_id
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN guardians g ON g.id = s.guardian_id
      WHERE e.id = ?`,
    [enrollmentId]
  );
  if (!row || Number(row.parent_user_id) !== Number(userId)) {
    throw ApiError.forbidden('Cet enfant ne fait pas partie de vos enfants.', 'ENFANT_NON_PARENT');
  }
  return row;
}

/** Liste des enfants du parent (année courante). */
async function mesEnfants(userId) {
  const courante = await yearRepo.findCurrent();
  if (!courante) return { annee: null, enfants: [] };
  const [rows] = await pool.query(
    `SELECT e.id AS enrollment_id, s.id AS student_id, s.matricule, s.nom, s.prenom, s.photo_path,
            e.statut, e.modalite_paiement, cl.nom AS classe_nom, a.nom AS alias_nom, cy.nom AS cycle_nom,
            e.montant_scolarite, e.frais_inscription
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN guardians g ON g.id = s.guardian_id
       JOIN class_aliases a ON a.id = e.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE g.user_id = ? AND e.academic_year_id = ? AND e.statut <> 'ANNULE'
      ORDER BY s.nom, s.prenom`,
    [userId, courante.id]
  );
  return { annee: courante, enfants: rows };
}

/** Tableau de bord parent : ses enfants + derniers messages par thème. */
async function dashboard(userId) {
  const { annee, enfants } = await mesEnfants(userId);

  const derniers = async (type) => {
    const { rows } = await notificationRepo.listByUser(userId, { parPage: 5, page: 1, type });
    return rows;
  };
  const [scolarite, absences, communiques] = await Promise.all([
    derniers('SCOLARITE'),
    derniers('ABSENCE'),
    derniers('COMMUNIQUE'),
  ]);
  // Les relances font partie de « scolarité » aux yeux du parent (type RELANCE).
  const relances = await derniers('RELANCE');
  const absencesEtRetards = [...absences, ...(await derniers('RETARD'))]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return {
    annee,
    enfants,
    scolarite: [...scolarite, ...relances].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    absences: absencesEtRetards,
    communiques,
  };
}

/** Notes d'un enfant en lecture seule (avec sa classe/alias). */
async function notesEnfant(userId, enrollmentId, evaluationPeriodId) {
  const enfant = await assertEnfantDuParent(userId, enrollmentId);
  const periodeCourante = evaluationPeriodId
    ? evaluationPeriodId
    : (await pool.query('SELECT id FROM evaluation_periods WHERE academic_year_id = ? ORDER BY ordre LIMIT 1', [enfant.academic_year_id]))[0][0]?.id;
  if (!periodeCourante) throw ApiError.notFound('Aucune période d’évaluation pour cette année.');

  const donnees = await collecterDonneesAlias({ academicYearId: enfant.academic_year_id, classAliasId: enfant.class_alias_id, periodeId: Number(periodeCourante) });
  const ligne = donnees.eleves.find((e) => e.enrollment_id === Number(enrollmentId));
  if (!ligne) throw ApiError.notFound('Élève introuvable dans cette classe.');

  const [[periode]] = await pool.query('SELECT id, libelle, ordre FROM evaluation_periods WHERE id = ?', [periodeCourante]);
  return {
    enfant: {
      enrollment_id: enfant.enrollment_id,
      matricule: enfant.matricule,
      nom: enfant.nom,
      prenom: enfant.prenom,
      classe_nom: donnees.aliasInfo.classe_nom,
      alias_nom: donnees.aliasInfo.alias_nom,
      cycle_nom: donnees.aliasInfo.cycle_nom,
      photo_path: enfant.photo_path,
    },
    periode,
    matieres: ligne.matieres,
    moyenneGenerale: ligne.moyenneGenerale,
    appreciation: appreciation(ligne.moyenneGenerale),
    rang: ligne.rang ?? null,
    effectif: donnees.effectif,
    moyenneClasse: donnees.moyenneClasse,
    absences: ligne.absences,
    absencesJustifiees: ligne.absencesJustifiees,
    absencesNonJustifiees: ligne.absencesNonJustifiees,
    retards: ligne.retards,
    retardMinutes: ligne.retardMinutes,
  };
}

/** Absences/retards d'un enfant + motifs (le parent peut en renseigner). */
async function absencesEnfant(userId, enrollmentId) {
  const enfant = await assertEnfantDuParent(userId, enrollmentId);
  const detail = await justificationService.absencesEleve(enrollmentId);
  return {
    enfant: {
      enrollment_id: enfant.enrollment_id,
      matricule: enfant.matricule,
      nom: enfant.nom,
      prenom: enfant.prenom,
      classe_nom: detail.eleve.classe_nom,
      alias_nom: detail.eleve.alias_nom,
      cycle_nom: detail.eleve.cycle_nom,
      photo_path: enfant.photo_path,
    },
    absences: detail.absences,
    summary: detail.summary,
  };
}

/** Parent : renseigne/modifie le motif d'une absence de son enfant. */
async function justifierAbsence(userId, recordId, motif) {
  return justificationService.justifierMotif(userId, recordId, motif);
}

/** Parent : retire le motif qu'il avait envoyé. */
async function retirerMotifAbsence(userId, recordId) {
  return justificationService.retirerMotif(userId, recordId);
}

/** Emploi du temps de l'alias de l'enfant (lecture seule). */
async function edtEnfant(userId, enrollmentId) {
  const enfant = await assertEnfantDuParent(userId, enrollmentId);
  const annee = await yearRepo.findById(enfant.academic_year_id);
  const creneaux = await timetableService.listerCreneaux({ class_alias_id: enfant.class_alias_id, academic_year_id: enfant.academic_year_id });
  return { annee, creneaux };
}

/** Situation financière de l'enfant (lecture seule) — preuve justificative masquée. */
async function financeEnfant(userId, enrollmentId) {
  await assertEnfantDuParent(userId, enrollmentId);
  const situation = await paymentService.situation(Number(enrollmentId));
  return {
    ...situation,
    payments: (situation.payments || []).map(({ justificatif_chemin, justificatif_at, ...p }) => p),
  };
}

module.exports = { mesEnfants, dashboard, notesEnfant, edtEnfant, financeEnfant, absencesEnfant, justifierAbsence, retirerMotifAbsence, assertEnfantDuParent };
