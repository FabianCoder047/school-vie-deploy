// Contrôleur HTTP — frais de scolarité (Directeur).
const feeService = require('../services/feeService');

async function lister(req, res, next) {
  try { res.json(await feeService.listerFrais(req.query.academic_year_id || null)); } catch (err) { next(err); }
}

async function enregistrerUnitaire(req, res, next) {
  try { res.json(await feeService.enregistrerFraisClasse(req.body, req.user.id, req.ip)); } catch (err) { next(err); }
}

async function enregistrerGroupe(req, res, next) {
  try {
    const resultats = await feeService.enregistrerFraisGroupe(req.body, req.user.id, req.ip);
    res.json({ enregistres: resultats.length });
  } catch (err) { next(err); }
}

module.exports = { lister, enregistrerUnitaire, enregistrerGroupe };
