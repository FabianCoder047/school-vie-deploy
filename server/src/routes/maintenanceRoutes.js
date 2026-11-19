// Routes de maintenance : statut public (page de maintenance du front).
// Les actions administrateur vivent dans adminRoutes (/api/admin/maintenance).
const express = require('express');
const maintenanceService = require('../services/maintenanceService');

const router = express.Router();

// Public : { active, planifiee, etat, debut, fin, message, etablissement }
// Aucune donnée sensible — utilisé par le front pour afficher la page de garde.
router.get('/maintenance/status', async (_req, res, next) => {
  try {
    res.json(await maintenanceService.statutPublic());
  } catch (e) {
    next(e);
  }
});

module.exports = router;
