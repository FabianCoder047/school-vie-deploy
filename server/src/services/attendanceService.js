// =====================================================================
// Appel (PROFESSEUR) : marquer présents / absents / retards (minutes)
// par élève et par séance. Une séance est unique par (professeur, date,
// heure de début) — modifiable le jour même. Chaque absence/retard
// notifie le parent de l'élève.
// =====================================================================
const pool = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const { log: audit } = require('../repositories/auditRepository');
const attendanceRepo = require('../repositories/attendanceRepository');
const notificationRepo = require('../repositories/notificationRepository');

const JOUR_SEMAINE = () => {
  // JS : 0=dimanche … 6=samedi ; schéma : 1=lundi … 7=dimanche
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
};
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Séance existante + records (pré-remplissage de l'écran d'appel). */
async function seanceDuJour({ teacherAssignmentId, dateCours, heureDebut }) {
  const session = await attendanceRepo.findSession({
    teacher_assignment_id: teacherAssignmentId,
    date_cours: dateCours,
    heure_debut: heureDebut,
  });
  if (!session) return { session: null, records: [] };
  return { session, records: await attendanceRepo.listRecords(session.id) };
}

/** Affectation de l'année courante appartenant au professeur. */
async function assertAssignationProfesseur(teacherAssignmentId, teacherId, academicYearId) {
  const [[assign]] = await pool.query(
    'SELECT id, teacher_id, academic_year_id, class_alias_id, class_subject_id FROM teacher_assignments WHERE id = ?',
    [teacherAssignmentId]
  );
  if (!assign || assign.teacher_id !== Number(teacherId) || assign.academic_year_id !== Number(academicYearId)) {
    throw ApiError.forbidden('Cette affectation ne vous appartient pas.', 'NON_AUTORISE');
  }
  return assign;
}

/**
 * Enregistre l'appel. Si la séance existe déjà (même prof × date × heure),
 * elle est REMPLACÉE en transaction (modifiable le jour même).
 */
async function enregistrerAppel({ teacherAssignmentId, timetableSlotId, dateCours, heureDebut, records }, actorId, ip) {
  const { academic_year_id } = await pool.query('SELECT id AS academic_year_id FROM academic_years WHERE is_current = 1 LIMIT 1').then(([[r]]) => r || {});
  if (!academic_year_id) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
  const assign = await assertAssignationProfesseur(teacherAssignmentId, actorId, academic_year_id);

  // Élèves de la classe/alias pour cette année — validation des enrollment_id.
  const [enrollments] = await pool.query(
    "SELECT id FROM enrollments WHERE class_alias_id = ? AND academic_year_id = ? AND statut <> 'ANNULE'",
    [assign.class_alias_id, academic_year_id]
  );
  const autorises = new Set(enrollments.map((e) => e.id));

  // Chaque élève ne peut apparaître qu'une fois.
  const vus = new Set();
  for (const record of records) {
    if (!autorises.has(record.enrollment_id)) {
      throw ApiError.badRequest('Un élève de l’appel n’appartient pas à cette classe/alias.', 'ELEVE_HORS_ALIAS');
    }
    if (vus.has(record.enrollment_id)) {
      throw ApiError.badRequest('Un élève apparaît plusieurs fois dans l’appel.', 'ELEVE_DUPLIQUE');
    }
    vus.add(record.enrollment_id);
    if (!['PRESENT', 'ABSENT', 'RETARD'].includes(record.statut)) {
      throw ApiError.badRequest('Statut invalide (PRESENT, ABSENT ou RETARD).', 'STATUT_INVALIDE');
    }
    if (record.statut === 'RETARD' && !(Number(record.minutes_retard) > 0)) {
      throw ApiError.badRequest('Un retard exige un nombre de minutes strictement positif.', 'MINUTES_REQUISES');
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let session = await attendanceRepo.findSession({
      teacher_assignment_id: teacherAssignmentId,
      date_cours: dateCours,
      heure_debut: heureDebut,
    });
    var anciensRecords = [];
    if (session) {
      const [rowsAnciens] = await conn.query(
        'SELECT enrollment_id, statut, minutes_retard FROM attendance_records WHERE session_id = ?',
        [session.id]
      );
      anciensRecords = rowsAnciens;
      await attendanceRepo.deleteRecordsForSession(session.id, conn);
    } else {
      const id = await attendanceRepo.createSession(
        { teacher_assignment_id: teacherAssignmentId, timetable_slot_id: timetableSlotId || null, date_cours: dateCours, heure_debut: heureDebut, created_by: actorId },
        conn
      );
      session = { id };
    }
    for (const record of records) {
      // eslint-disable-next-line no-await-in-loop
      await attendanceRepo.upsertRecord({
        session_id: session.id,
        enrollment_id: record.enrollment_id,
        statut: record.statut,
        minutes_retard: record.statut === 'RETARD' ? Math.round(Number(record.minutes_retard)) : null,
        justification: record.justification?.trim() || null,
      }, conn);
    }
    const sessionId = session.id;
    await conn.commit();
    var detailsPourNotifs = await detailsSeance(assign.id);
    var sessionFinalId = sessionId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Post-commit : notifications uniquement pour les NOUVEAUX absents/retards
  // (rejouer le même appel ne re-notifie pas — idempotence jour même).
  try {
    const details = detailsPourNotifs;
    const anciens = new Map(anciensRecords.map((r) => [r.enrollment_id, r]));
    for (const record of records) {
      if (record.statut === 'PRESENT') continue;
      const ancien = anciens.get(record.enrollment_id);
      const minutes = record.statut === 'RETARD' ? Math.round(Number(record.minutes_retard)) : null;
      const inchange = ancien
        && ancien.statut === record.statut
        && (record.statut !== 'RETARD' || Number(ancien.minutes_retard || 0) === minutes);
      if (inchange) continue; // déjà notifié lors d'une saisie précédente
      const [[row]] = await pool.query(
        `SELECT s.nom AS eleve_nom, s.prenom AS eleve_prenom, s.matricule,
                g.user_id AS parent_user_id, u.prenom AS parent_prenom
           FROM enrollments e
           JOIN students s ON s.id = e.student_id
           JOIN guardians g ON g.id = s.guardian_id
           LEFT JOIN users u ON u.id = g.user_id
          WHERE e.id = ?`,
        [record.enrollment_id]
      );
      if (!row?.parent_user_id) continue;
      const type = record.statut === 'ABSENT' ? 'ABSENCE' : 'RETARD';
      const titre = record.statut === 'ABSENT' ? 'Absence de votre enfant' : 'Retard de votre enfant';
      const message = record.statut === 'ABSENT'
        ? `${row.eleve_prenom} ${row.eleve_nom} (${row.matricule}) était absent(e) le ${new Date(dateCours).toLocaleDateString('fr-FR')} en ${details.matiere_nom}.`
        : `${row.eleve_prenom} ${row.eleve_nom} (${row.matricule}) est arrivé(e) avec ${Math.round(Number(record.minutes_retard))} minute(s) de retard le ${new Date(dateCours).toLocaleDateString('fr-FR')} en ${details.matiere_nom}.`;
      // eslint-disable-next-line no-await-in-loop
      await notificationRepo.create({
        user_id: row.parent_user_id,
        type,
        titre,
        message,
        data: { enrollmentId: record.enrollment_id, sessionId: sessionFinalId, dateCours, matiere: details.matiere_nom },
      });
    }
  } catch (err) {
    const logger = require('../utils/logger');
    logger.error('Notifications d’appel non créées (présences enregistrées)', { message: err.message });
  }

  await audit({
    userId: actorId,
    action: 'UPSERT_ATTENDANCE',
    entity: 'attendance_sessions',
    entityId: sessionFinalId,
    newValues: { dateCours, nb: records.length, absences: records.filter((r) => r.statut === 'ABSENT').length, retards: records.filter((r) => r.statut === 'RETARD').length },
    ipAddress: ip,
  });
  return { sessionId: sessionFinalId, total: records.length };
}

async function detailsSeance(teacherAssignmentId) {
  const [[row]] = await pool.query(
    `SELECT s.nom AS matiere_nom, a.nom AS alias_nom, cl.nom AS classe_nom
       FROM teacher_assignments ta
       JOIN class_subjects cs ON cs.id = ta.class_subject_id
       JOIN subjects s ON s.id = cs.subject_id
       JOIN class_aliases a ON a.id = ta.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
      WHERE ta.id = ?`,
    [teacherAssignmentId]
  );
  return row || {};
}

/** Créneaux du professeur pour aujourd'hui (écran d'appel). */
async function creneauxDuJour(teacherId) {
  const jour = JOUR_SEMAINE();
  const courante = await pool.query('SELECT id FROM academic_years WHERE is_current = 1 LIMIT 1').then(([[r]]) => r?.id || null);
  if (!courante) return [];
  const [rows] = await pool.query(
    `SELECT ts.id AS timetable_slot_id, ts.heure_debut, ts.heure_fin, ts.salle, ts.jour_semaine,
            a.id AS alias_id, a.nom AS alias_nom, cl.nom AS classe_nom, s.nom AS matiere_nom,
            ta.id AS teacher_assignment_id
       FROM timetable_slots ts
       JOIN teacher_assignments ta ON ta.id = ts.teacher_assignment_id
       JOIN class_aliases a ON a.id = ts.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
       JOIN class_subjects cs ON cs.id = ta.class_subject_id
       JOIN subjects s ON s.id = cs.subject_id
      WHERE ts.academic_year_id = ? AND ta.teacher_id = ? AND ts.jour_semaine = ?
      ORDER BY ts.heure_debut`,
    [courante, teacherId, jour]
  );
  return rows;
}

module.exports = { seanceDuJour, enregistrerAppel, creneauxDuJour, JOURS };
