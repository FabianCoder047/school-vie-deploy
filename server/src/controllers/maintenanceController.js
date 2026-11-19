// Contrôleur HTTP — fenêtre de maintenance (réservé ADMIN, monté dans adminRoutes).
const maintenanceService = require('../services/maintenanceService');

async function lireMaintenance(_req, res, next) {
  try { res.json(await maintenanceService.configAdmin()); } catch (e) { next(e); }
}

async function definirMaintenance(req, res, next) {
  try {
    const { debut, fin, message } = req.body;
    res.json(await maintenanceService.definirPeriode({ debut, fin, message }, req.user.id, req.ip));
  } catch (e) { next(e); }
}

async function terminerMaintenance(req, res, next) {
  try { res.json(await maintenanceService.terminerMaintenance(req.user.id, req.ip)); } catch (e) { next(e); }
}

module.exports = { lireMaintenance, definirMaintenance, terminerMaintenance };
