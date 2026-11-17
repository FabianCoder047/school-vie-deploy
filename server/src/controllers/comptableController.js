// Contrôleur HTTP — comptabilité : paiements, comptes, relances, rapports.
const paymentService = require('../services/paymentService');
const pdfDocuments = require('../services/pdfDocumentsService');
const accountService = require('../services/accountService');
const paymentRepo = require('../repositories/paymentRepository');
const { ApiError } = require('../utils/ApiError');

/* ===== PAIEMENTS ===== */
async function payerScolarite(req, res, next) {
  try {
    const result = await paymentService.payerScolarite(req.body, req.user.id, req.ip);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function annulerPaiement(req, res, next) {
  try {
    const result = await paymentService.annulerPaiement(Number(req.params.paymentId), req.body.motif, req.user.id, req.ip);
    res.json(result);
  } catch (err) { next(err); }
}

async function recuPaiement(req, res, next) {
  try {
    const payment = await paymentRepo.findById(Number(req.params.paymentId));
    if (!payment) throw ApiError.notFound('Paiement introuvable.');
    await pdfDocuments.genererRecu(res, payment, 'COMPTABLE');
  } catch (err) { next(err); }
}

/* ===== COMPTES DE SCOLARITÉ ===== */
async function listerComptes(req, res, next) {
  try { res.json(await accountService.listerComptes(req.query)); } catch (err) { next(err); }
}

async function situation(req, res, next) {
  try { res.json(await paymentService.situation(Number(req.params.enrollmentId))); } catch (err) { next(err); }
}

async function comptesEnRetard(req, res, next) {
  try { res.json(await accountService.selectionnerEnRetard(req.query)); } catch (err) { next(err); }
}

/* ===== FICHES DE RETARD (PDF) ===== */
async function fichesRetardPdf(req, res, next) {
  try {
    await pdfDocuments.genererFichesRetard(res, req.query, `${req.user.prenom} ${req.user.nom}`);
  } catch (err) { next(err); }
}

/* ===== RELANCES ===== */
async function relancer(req, res, next) {
  try {
    const result = await accountService.relancerParents(req.body, req.user.id, req.ip);
    res.json(result);
  } catch (err) { next(err); }
}

async function historiqueRelances(req, res, next) {
  try {
    const { parsePagination } = require('../utils/pagination');
    const { page, parPage, offset } = parsePagination(req.query);
    res.json(await paymentRepo.listReminders({ page, parPage, offset, enrollmentId: req.query.enrollment_id }));
  } catch (err) { next(err); }
}

/* ===== RAPPORTS ===== */
async function rapportJson(req, res, next) {
  try { res.json(await accountService.rapportParClasse(req.query)); } catch (err) { next(err); }
}

async function rapportPdf(req, res, next) {
  try { await pdfDocuments.genererRapportPdf(res, req.query, `${req.user.prenom} ${req.user.nom}`); } catch (err) { next(err); }
}

/* ===== DASHBOARD ===== */
async function dashboard(_req, res, next) {
  try { res.json(await require('../services/dashboardService').dashboardComptable()); } catch (err) { next(err); }
}

module.exports = {
  payerScolarite,
  annulerPaiement,
  recuPaiement,
  listerComptes,
  situation,
  comptesEnRetard,
  fichesRetardPdf,
  relancer,
  historiqueRelances,
  rapportJson,
  rapportPdf,
  dashboard,
};
