// Contrôleur HTTP — communiqués (création ciblée, liste, génération PDF cartes/bulletins).
const announcementService = require('../services/announcementService');
const carteService = require('../services/carteService');
const bulletinService = require('../services/bulletinService');
const yearRepo = require('../repositories/academicYearRepository');
const { ApiError } = require('../utils/ApiError');

/* ===== COMMUNIQUÉS ===== */
async function publierCommunique(req, res, next) {
  try {
    const result = await announcementService.publier(req.body, req.user.id, req.ip);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function listerCommuniques(_req, res, next) {
  try { res.json(await announcementService.listerCommuniques()); } catch (err) { next(err); }
}

/* ===== CARTES SCOLAIRES (PDF à la volée, 8 par page) ===== */
async function cartesAlias(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
    await carteService.genererCartesAlias(res, { academicYearId: courante.id, classAliasId: Number(req.params.classAliasId) });
  } catch (err) { next(err); }
}

async function cartesCycle(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
    await carteService.genererCartesCycle(res, { academicYearId: courante.id, cycleId: Number(req.params.cycleId) });
  } catch (err) { next(err); }
}

/* ===== BULLETINS (PDF à la volée, une page par élève) ===== */
async function bulletinsAlias(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
    if (!req.query.evaluation_period_id) throw ApiError.badRequest('La période (evaluation_period_id) est requise.', 'PARAMS_REQUIS');
    await bulletinService.genererBulletinsAlias(res, {
      academicYearId: courante.id,
      classAliasId: Number(req.params.classAliasId),
      periodeId: Number(req.query.evaluation_period_id),
    });
  } catch (err) { next(err); }
}

async function bulletinsCycle(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
    if (!req.query.evaluation_period_id) throw ApiError.badRequest('La période (evaluation_period_id) est requise.', 'PARAMS_REQUIS');
    await bulletinService.genererBulletinsCycle(res, {
      academicYearId: courante.id,
      cycleId: Number(req.params.cycleId),
      periodeId: Number(req.query.evaluation_period_id),
    });
  } catch (err) { next(err); }
}

module.exports = {
  publierCommunique,
  listerCommuniques,
  cartesAlias,
  cartesCycle,
  bulletinsAlias,
  bulletinsCycle,
};
