// Contrôleur HTTP — profil de l'utilisateur connecté.
const profileService = require('../services/profileService');

async function lire(req, res, next) {
  try { res.json(await profileService.lireProfil(req.user.id)); } catch (e) { next(e); }
}
async function modifier(req, res, next) {
  try { res.json(await profileService.modifierProfil(req.user.id, req.body, req.ip)); } catch (e) { next(e); }
}

module.exports = { lire, modifier };
