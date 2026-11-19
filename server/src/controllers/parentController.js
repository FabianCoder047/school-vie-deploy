// Contrôleur HTTP — espace Parent.
const parentService = require('../services/parentService');

async function dashboard(req, res, next) {
  try { res.json(await parentService.dashboard(req.user.id)); } catch (e) { next(e); }
}

async function mesEnfants(req, res, next) {
  try { res.json(await parentService.mesEnfants(req.user.id)); } catch (e) { next(e); }
}

async function notesEnfant(req, res, next) {
  try {
    res.json(await parentService.notesEnfant(req.user.id, Number(req.params.enrollmentId), req.query.evaluation_period_id ? Number(req.query.evaluation_period_id) : null));
  } catch (e) { next(e); }
}

async function absencesEnfant(req, res, next) {
  try {
    res.json(await parentService.absencesEnfant(req.user.id, Number(req.params.enrollmentId)));
  } catch (e) { next(e); }
}

async function justifierMotif(req, res, next) {
  try {
    res.json(await parentService.justifierAbsence(req.user.id, Number(req.params.recordId), req.body.motif));
  } catch (e) { next(e); }
}

async function retirerMotif(req, res, next) {
  try {
    res.json(await parentService.retirerMotifAbsence(req.user.id, Number(req.params.recordId)));
  } catch (e) { next(e); }
}

async function edtEnfant(req, res, next) {
  try { res.json(await parentService.edtEnfant(req.user.id, Number(req.params.enrollmentId))); } catch (e) { next(e); }
}

async function financeEnfant(req, res, next) {
  try { res.json(await parentService.financeEnfant(req.user.id, Number(req.params.enrollmentId))); } catch (e) { next(e); }
}

module.exports = { dashboard, mesEnfants, notesEnfant, edtEnfant, financeEnfant, absencesEnfant, justifierMotif, retirerMotif };
