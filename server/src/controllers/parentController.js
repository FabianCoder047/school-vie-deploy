// Contrôleur HTTP — espace Parent (lecture seule, ses enfants uniquement).
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

async function edtEnfant(req, res, next) {
  try { res.json(await parentService.edtEnfant(req.user.id, Number(req.params.enrollmentId))); } catch (e) { next(e); }
}

async function financeEnfant(req, res, next) {
  try { res.json(await parentService.financeEnfant(req.user.id, Number(req.params.enrollmentId))); } catch (e) { next(e); }
}

module.exports = { dashboard, mesEnfants, notesEnfant, edtEnfant, financeEnfant };
