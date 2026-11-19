// Contrôleur HTTP — périodes d'évaluation et emploi du temps (Directeur).
const evaluationPeriodService = require('../services/evaluationPeriodService');
const timetableService = require('../services/timetableService');
const edtPdf = require('../services/emploiDuTempsPdfService');

/* ===== PÉRIODES ===== */
async function listerPeriodes(req, res, next) {
  try { res.json(await evaluationPeriodService.listerPeriodes(req.query.academic_year_id || null)); } catch (e) { next(e); }
}
async function creerPeriode(req, res, next) {
  try { res.status(201).json(await evaluationPeriodService.creerPeriode(req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function modifierPeriode(req, res, next) {
  try { res.json(await evaluationPeriodService.modifierPeriode(Number(req.params.id), req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function supprimerPeriode(req, res, next) {
  try { res.json(await evaluationPeriodService.supprimerPeriode(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}

/* ===== EMPLOI DU TEMPS ===== */
async function listerCreneaux(req, res, next) {
  try { res.json(await timetableService.listerCreneaux(req.query)); } catch (e) { next(e); }
}
async function affectationsPourAlias(req, res, next) {
  try { res.json(await timetableService.affectationsPourAlias(req.query)); } catch (e) { next(e); }
}
async function configurationEdt(req, res, next) {
  try { res.json(await timetableService.configurationHoraires()); } catch (e) { next(e); }
}
async function edtPdfAlias(req, res, next) {
  try { await edtPdf.genererPdf(res, { classAliasId: req.query.class_alias_id }); } catch (e) { next(e); }
}
async function edtPdfClasse(req, res, next) {
  try { await edtPdf.genererPdf(res, { classeId: req.query.classe_id }); } catch (e) { next(e); }
}
async function edtPdfCycle(req, res, next) {
  try { await edtPdf.genererPdf(res, { cycleId: req.query.cycle_id }); } catch (e) { next(e); }
}
async function creerCreneau(req, res, next) {
  try { res.status(201).json(await timetableService.creerCreneau(req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function modifierCreneau(req, res, next) {
  try { res.json(await timetableService.modifierCreneau(Number(req.params.id), req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function supprimerCreneau(req, res, next) {
  try { res.json(await timetableService.supprimerCreneau(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}

module.exports = {
  listerPeriodes, creerPeriode, modifierPeriode, supprimerPeriode,
  listerCreneaux, affectationsPourAlias, configurationEdt,
  edtPdfAlias, edtPdfClasse, edtPdfCycle,
  creerCreneau, modifierCreneau, supprimerCreneau,
};
