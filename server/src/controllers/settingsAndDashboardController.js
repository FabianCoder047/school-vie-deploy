// Contrôleur HTTP — paramètres de l'école + dashboards Admin/Directeur.
const settingsService = require('../services/settingsService');
const dashboardService = require('../services/dashboardService');
const userManagementService = require('../services/userManagementService');

async function lireParametres(_req, res, next) {
  try { res.json(await settingsService.lireParametres()); } catch (e) { next(e); }
}

async function modifierParametres(req, res, next) {
  try { res.json(await settingsService.modifierParametres(req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}

async function lireDelegations(_req, res, next) {
  try { res.json(await settingsService.lireDelegations()); } catch (e) { next(e); }
}

async function modifierDelegations(req, res, next) {
  try { res.json(await settingsService.modifierDelegations(req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}

async function uploadLogo(req, res, next) {
  try { res.json(await settingsService.definirLogo(req.file, req.user.id, req.ip)); } catch (e) { next(e); }
}

async function uploadCachet(req, res, next) {
  try { res.json(await settingsService.definirCachet(req.file, req.user.id, req.ip)); } catch (e) { next(e); }
}

async function supprimerCachet(req, res, next) {
  try { res.json(await settingsService.supprimerCachet(req.user.id, req.ip)); } catch (e) { next(e); }
}

async function dashboardAdmin(_req, res, next) {
  try { res.json(await dashboardService.dashboardAdmin()); } catch (e) { next(e); }
}

async function dashboardDirecteur(_req, res, next) {
  try { res.json(await dashboardService.dashboardDirecteur()); } catch (e) { next(e); }
}

async function listerProfesseurs(_req, res, next) {
  try { res.json(await userManagementService.listerProfesseurs()); } catch (e) { next(e); }
}

module.exports = {
  lireParametres, modifierParametres, lireDelegations, modifierDelegations,
  uploadLogo, uploadCachet, supprimerCachet,
  dashboardAdmin, dashboardDirecteur, listerProfesseurs,
};
