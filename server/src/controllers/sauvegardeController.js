// Contrôleur HTTP — sauvegardes et restauration (Directeur).
const sauvegardeService = require('../services/sauvegardeService');

async function generer(req, res, next) {
  try {
    await sauvegardeService.genererEtStreamer(res, req.body, req.user.id, req.ip);
  } catch (err) { next(err); }
}

async function lister(_req, res, next) {
  try { res.json(await sauvegardeService.listerSauvegardes()); } catch (err) { next(err); }
}

async function restaurer(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier reçu.' });
    }
    const result = await sauvegardeService.restaurer(req.file.buffer, req.user.id, req.ip);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { generer, lister, restaurer };
