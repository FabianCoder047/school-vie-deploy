// Contrôleur HTTP — communiqués (création ciblée, liste, génération PDF cartes/bulletins).
const announcementService = require('../services/announcementService');
const carteService = require('../services/carteService');
const bulletinService = require('../services/bulletinService');
const yearRepo = require('../repositories/academicYearRepository');
const { ApiError } = require('../utils/ApiError');
const { log: audit } = require('../repositories/auditRepository');

/* ===== COMMUNIQUÉS ===== */
async function publierCommunique(req, res, next) {
  try {
    const result = await announcementService.publier(req.body, req.user.id, req.ip);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

/* Liste COMPLÈTE (pilotage) — réservée au directeur et à la secrétaire (monteurs de communiqués). */
async function listerCommuniques(_req, res, next) {
  try { res.json(await announcementService.listerCommuniques()); } catch (err) { next(err); }
}

/* Liste pour n'importe quel utilisateur : tout si personnel de pilotage
   (ADMIN / DIRECTEUR / SECRETAIRE), sinon uniquement les communiqués qui le concernent. */
async function listerCommuniquesPourMoi(req, res, next) {
  try { res.json(await announcementService.listerPourMoi(req.user)); } catch (err) { next(err); }
}

/* ===== CARTES SCOLAIRES (PDF à la volée, 8 par page) ===== */
async function cartesAlias(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
    await audit({ userId: req.user.id, action: 'GENERATE_CARTES', entity: 'cartes', entityId: Number(req.params.classAliasId), newValues: { scope: 'ALIAS', class_alias_id: Number(req.params.classAliasId), role: req.user.role }, ipAddress: req.ip });
    await carteService.genererCartesAlias(res, { academicYearId: courante.id, classAliasId: Number(req.params.classAliasId) });
  } catch (err) { next(err); }
}

async function cartesCycle(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
    await audit({ userId: req.user.id, action: 'GENERATE_CARTES', entity: 'cartes', entityId: Number(req.params.cycleId), newValues: { scope: 'CYCLE', cycle_id: Number(req.params.cycleId), role: req.user.role }, ipAddress: req.ip });
    await carteService.genererCartesCycle(res, { academicYearId: courante.id, cycleId: Number(req.params.cycleId) });
  } catch (err) { next(err); }
}

/* ===== BULLETINS (PDF à la volée, une page par élève) ===== */
async function bulletinsAlias(req, res, next) {
  try {
    const courante = await yearRepo.findCurrent();
    if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
    if (!req.query.evaluation_period_id) throw ApiError.badRequest('La période (evaluation_period_id) est requise.', 'PARAMS_REQUIS');
    await audit({ userId: req.user.id, action: 'GENERATE_BULLETINS', entity: 'bulletins', entityId: Number(req.params.classAliasId), newValues: { scope: 'ALIAS', class_alias_id: Number(req.params.classAliasId), evaluation_period_id: Number(req.query.evaluation_period_id), role: req.user.role }, ipAddress: req.ip });
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
    await audit({ userId: req.user.id, action: 'GENERATE_BULLETINS', entity: 'bulletins', entityId: Number(req.params.cycleId), newValues: { scope: 'CYCLE', cycle_id: Number(req.params.cycleId), evaluation_period_id: Number(req.query.evaluation_period_id), role: req.user.role }, ipAddress: req.ip });
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
  listerCommuniquesPourMoi,
  cartesAlias,
  cartesCycle,
  bulletinsAlias,
  bulletinsCycle,
};
