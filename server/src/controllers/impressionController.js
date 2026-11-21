// Contrôleur HTTP — feu vert du directeur (impression cartes / bulletins / fiches de
// proclamation par la secrétaire).
const impressionService = require('../services/impressionService');

async function basculerCartes(req, res, next) {
  try {
    res.json(await impressionService.basculer('cartes', Boolean(req.body.autorisee), req.user.id, req.ip));
  } catch (err) { next(err); }
}

async function basculerBulletins(req, res, next) {
  try {
    res.json(await impressionService.basculer('bulletins', Boolean(req.body.autorisee), req.user.id, req.ip));
  } catch (err) { next(err); }
}

async function basculerProclamations(req, res, next) {
  try {
    res.json(await impressionService.basculer('proclamations', Boolean(req.body.autorisee), req.user.id, req.ip));
  } catch (err) { next(err); }
}

async function basculerEdts(req, res, next) {
  try {
    res.json(await impressionService.basculer('edts', Boolean(req.body.autorisee), req.user.id, req.ip));
  } catch (err) { next(err); }
}

module.exports = { basculerCartes, basculerBulletins, basculerProclamations, basculerEdts };
