// Contrôleur HTTP — espace Professeur : accueil, notes, appel, EDT perso, KPI.
const pool = require('../config/db');
const yearRepo = require('../repositories/academicYearRepository');
const gradeService = require('../services/gradeService');
const attendanceService = require('../services/attendanceService');
const timetableService = require('../services/timetableService');
const attendanceRepo = require('../repositories/attendanceRepository');
const { moyenneMatiere, moyenneGenerale } = require('../services/moyenneService');
const { ApiError } = require('../utils/ApiError');

/* ===== ACCUEIL : mes classes ===== */
async function mesClasses(req, res, next) {
  try { res.json(await gradeService.mesClasses(req.user.id)); } catch (e) { next(e); }
}

/* ===== FEUILLE DE NOTES ===== */
async function feuille(req, res, next) {
  try {
    res.json(await gradeService.feuille({
      teacherId: req.user.id,
      classAliasId: Number(req.query.class_alias_id),
      classSubjectId: Number(req.query.class_subject_id),
      evaluationPeriodId: Number(req.query.evaluation_period_id),
    }));
  } catch (e) { next(e); }
}

async function enregistrerFeuille(req, res, next) {
  try {
    const result = await gradeService.enregistrerFeuille({
      teacherId: req.user.id,
      classAliasId: Number(req.body.class_alias_id),
      classSubjectId: Number(req.body.class_subject_id),
      evaluationPeriodId: Number(req.body.evaluation_period_id),
      notes: req.body.notes,
    }, req.user.id, req.ip);
    res.json(result);
  } catch (e) { next(e); }
}

/** Élèves inscrits dans un alias pour l'année courante (écran d'appel). */
async function elevesAlias(req, res, next) {
  try {
    const aliasId = Number(req.query.class_alias_id);
    if (!aliasId) throw ApiError.badRequest('class_alias_id est requis.', 'PARAMS_REQUIS');
    const courante = await yearRepo.findCurrent();
    if (!courante) return res.json([]);
    const [rows] = await pool.query(
      `SELECT e.id AS enrollment_id, s.matricule, s.nom, s.prenom, s.photo_path
         FROM enrollments e JOIN students s ON s.id = e.student_id
        WHERE e.class_alias_id = ? AND e.academic_year_id = ? AND e.statut <> 'ANNULE'
        ORDER BY s.nom, s.prenom`,
      [aliasId, courante.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

/* ===== APPEL ===== */
async function seanceDuJour(req, res, next) {
  try {
    if (!req.query.teacher_assignment_id || !req.query.date_cours || !req.query.heure_debut) {
      throw ApiError.badRequest('teacher_assignment_id, date_cours et heure_debut sont requis.', 'PARAMS_REQUIS');
    }
    res.json(await attendanceService.seanceDuJour({
      teacherAssignmentId: Number(req.query.teacher_assignment_id),
      dateCours: req.query.date_cours,
      heureDebut: req.query.heure_debut,
    }));
  } catch (e) { next(e); }
}

async function creneauxDuJour(_req, res, next) {
  try {
    // Réutilise l'utilisateur connecté pour ne montrer que SES créneaux.
    res.json(await attendanceService.creneauxDuJour(_req.user.id));
  } catch (e) { next(e); }
}

async function enregistrerAppel(req, res, next) {
  try {
    const result = await attendanceService.enregistrerAppel({
      teacherAssignmentId: Number(req.body.teacher_assignment_id),
      timetableSlotId: req.body.timetable_slot_id ? Number(req.body.timetable_slot_id) : null,
      dateCours: req.body.date_cours,
      heureDebut: req.body.heure_debut,
      records: req.body.records,
    }, req.user.id, req.ip);
    res.status(201).json(result);
  } catch (e) { next(e); }
}

async function seancesRecentes(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    if (!courante) return res.json([]);
    const [rows] = await pool.query(
      'SELECT id FROM teacher_assignments WHERE teacher_id = ? AND academic_year_id = ?',
      [req.user.id, courante.id]
    );
    res.json(await attendanceRepo.listRecentSessions(rows.map((r) => r.id)));
  } catch (e) { next(e); }
}

/* ===== MON EMPLOI DU TEMPS (lecture seule) ===== */
async function monEdt(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    if (!courante) return res.json({ annee: null, creneaux: [] });
    const creneaux = await timetableService.listerCreneaux({ teacher_id: req.user.id, academic_year_id: courante.id });
    res.json({ annee: courante, creneaux });
  } catch (e) { next(e); }
}

/* ===== DASHBOARD ===== */
async function dashboard(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    const classes = await gradeService.mesClasses(req.user.id);
    const nbClasses = new Set(classes.classes.map((c) => c.alias_id)).size;
    const nbMatieres = classes.classes.length;
    // Effectif par alias, compté une seule fois même si plusieurs matières.
    const effectifParAlias = new Map();
    for (const c of classes.classes) effectifParAlias.set(c.alias_id, c.effectif);
    const effectifTotal = [...effectifParAlias.values()].reduce((a, b) => a + b, 0);

    // Prochain cours (aujourd'hui, horaire >= maintenant)
    const jour = new Date().getDay() === 0 ? 7 : new Date().getDay();
    const maintenant = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    const creneaux = courante ? await timetableService.listerCreneaux({ teacher_id: req.user.id, academic_year_id: courante.id }) : [];
    const aujourdHui = creneaux
      .filter((c) => c.jour_semaine === jour && String(c.heure_debut).slice(0, 5) >= maintenant)
      .sort((a, b) => String(a.heure_debut).localeCompare(String(b.heure_debut)));
    const prochainCours = aujourdHui[0] || null;

    // Graphique : moyenne générale par classe (sur les notes saisies, toutes périodes).
    const [grades] = courante ? await pool.query(
      `SELECT e.class_alias_id, a.nom AS alias_nom, cl.nom AS classe_nom,
              g.interro, g.devoir, g.compo, cs.coefficient
         FROM grades g
         JOIN enrollments e ON e.id = g.enrollment_id
         JOIN class_subjects cs ON cs.id = g.class_subject_id
         JOIN class_aliases a ON a.id = e.class_alias_id
         JOIN classes cl ON cl.id = a.class_id
        WHERE e.academic_year_id = ?`,
      [courante.id]
    ) : [[]];

    const parAlias = new Map();
    for (const g of grades) {
      const key = g.class_alias_id;
      if (!parAlias.has(key)) {
        parAlias.set(key, { alias: g.alias_nom, classe: g.classe_nom, lignes: [] });
      }
      parAlias.get(key).lignes.push({ moyenne: moyenneMatiere(g), coefficient: Number(g.coefficient) });
    }
    // Absences du mois dans mes classes + appels cette semaine
    const mesAliases = classes.classes.map((c) => c.alias_id);
    let absencesMois = 0;
    if (mesAliases.length > 0) {
      const placeholders = mesAliases.map(() => '?').join(',');
      const [[{ abs }]] = await pool.query(
        `SELECT COUNT(*) AS abs FROM attendance_records ar
           JOIN attendance_sessions ats ON ats.id = ar.session_id
           JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
          WHERE ta.class_alias_id IN (${placeholders}) AND ar.statut = 'ABSENT'
            AND ats.date_cours >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
        mesAliases
      );
      absencesMois = Number(abs);
    }

    const moyennesParClasse = [...parAlias.values()].map((g) => ({
      alias: g.alias,
      classe: g.classe,
      moyenne: moyenneGenerale(g.lignes),
    })).sort((a, b) => a.alias.localeCompare(b.alias));

    res.json({
      anneeCourante: courante?.libelle || null,
      nbClasses,
      nbMatieres,
      nbEleves: effectifTotal,
      absencesMois,
      prochainCours: prochainCours ? {
        heure_debut: prochainCours.heure_debut,
        heure_fin: prochainCours.heure_fin,
        matiere_nom: prochainCours.matiere_nom,
        alias_nom: prochainCours.alias_nom,
      } : null,
      moyennesParClasse,
    });
  } catch (e) { next(e); }
}

module.exports = {
  mesClasses, feuille, enregistrerFeuille, elevesAlias,
  seanceDuJour, creneauxDuJour, enregistrerAppel, seancesRecentes,
  monEdt, dashboard,
};
