// Statistiques de présences (directeur / secrétaire) + détail par élève.
const yearRepo = require('../repositories/academicYearRepository');
const presenceStatsService = require('../services/presenceStatsService');
const justificationService = require('../services/justificationService');

/** Détermine la période ciblée : paramètre explicite (id ou « all ») ou période courante. */
async function resoudrePeriodeId(anneeId, brut) {
  if (brut === 'all') return null; // null = toute l'année
  if (brut !== undefined && brut !== '') return Number(brut);
  const defaut = await presenceStatsService.periodeParDefaut(anneeId);
  return defaut ? defaut.id : null;
}

/** GET /directeur/statistiques-presences et /secretaire/statistiques-presences */
async function statistiques(req, res, next) {
  try {
    const annee = await yearRepo.findCurrent();
    if (!annee) {
      return res.json({ periode: null, periodes: [], aliasFiltre: null, totaux: null, parAlias: [], parPeriode: [], parEleve: [] });
    }
    const periodeId = await resoudrePeriodeId(annee.id, req.query.evaluation_period_id);
    const aliasId = req.query.alias_id ? Number(req.query.alias_id) : null;
    res.json(await presenceStatsService.statistiquesPresences({ academicYearId: annee.id, periodeId, aliasId }));
  } catch (e) { next(e); }
}

/** GET /directeur/eleve/:enrollmentId/absences — fiche absences d'un élève. */
async function absencesEleveDirecteur(req, res, next) {
  try {
    res.json(await justificationService.absencesEleve(Number(req.params.enrollmentId)));
  } catch (e) { next(e); }
}

/** GET /professeur/eleves-absences — élèves des alias du prof + compteurs. */
async function elevesAbsencesProfesseur(req, res, next) {
  try {
    const annee = await yearRepo.findCurrent();
    if (!annee) return res.json({ periodes: [], periode: null, alias: [], eleves: [] });
    const periodeId = await resoudrePeriodeId(annee.id, req.query.evaluation_period_id);
    res.json(await presenceStatsService.elevesAbsencesProfesseur(req.user.id, annee.id, periodeId));
  } catch (e) { next(e); }
}

/** GET /professeur/eleve/:enrollmentId/absences — prof : fiche de SON élève. */
async function absencesEleveProfesseur(req, res, next) {
  try {
    const annee = await yearRepo.findCurrent();
    if (!annee) throw Object.assign(new Error('Aucune année académique courante.'), { status: 400 });
    const enrollmentId = Number(req.params.enrollmentId);
    await justificationService.assertProfesseurDeLEleve(req.user.id, enrollmentId, annee.id);
    res.json(await justificationService.absencesEleve(enrollmentId));
  } catch (e) { next(e); }
}

module.exports = { statistiques, absencesEleveDirecteur, elevesAbsencesProfesseur, absencesEleveProfesseur };
