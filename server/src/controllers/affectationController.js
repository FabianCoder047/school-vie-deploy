// Contrôleur HTTP — alias, affectations matière↔classes, affectations professeur.
const service = require('../services/affectationService');

/* ALIAS */
async function listerAlias(req, res, next) {
  try { res.json(await service.listerAlias(req.query)); } catch (e) { next(e); }
}
async function listerAliasDeClasse(req, res, next) {
  try { res.json(await service.listerAliasDeClasse(Number(req.params.classId))); } catch (e) { next(e); }
}
async function creerAlias(req, res, next) {
  try { res.status(201).json(await service.creerAlias(req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function modifierAlias(req, res, next) {
  try { res.json(await service.modifierAlias(Number(req.params.id), req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function supprimerAlias(req, res, next) {
  try { res.json(await service.supprimerAlias(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}

/* MATIÈRE → CLASSES */
async function listerAffectations(req, res, next) {
  try { res.json(await service.listerAffectations(req.query)); } catch (e) { next(e); }
}
async function affecterMatiere(req, res, next) {
  try {
    const result = await service.affecterMatiereAuxClasses(Number(req.body.subject_id), req.body.affectations, req.user.id, req.ip);
    res.json({ affectations: result });
  } catch (e) { next(e); }
}
async function retirerAffectationMatiere(req, res, next) {
  try { res.json(await service.retirerAffectationMatiere(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}

/* PROFESSEUR → (MATIÈRE × ALIAS × ANNÉE) */
async function listerAffectationsProfesseur(req, res, next) {
  try { res.json(await service.listerAffectationsProfesseur(req.query)); } catch (e) { next(e); }
}
async function affecterProfesseur(req, res, next) {
  try {
    const result = await service.affecterProfesseur(req.body, req.user.id, req.ip);
    res.status(201).json({ affectations: result });
  } catch (e) { next(e); }
}
async function retirerAffectationProfesseur(req, res, next) {
  try { res.json(await service.retirerAffectationProfesseur(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}

module.exports = {
  listerAlias, listerAliasDeClasse, creerAlias, modifierAlias, supprimerAlias,
  listerAffectations, affecterMatiere, retirerAffectationMatiere,
  listerAffectationsProfesseur, affecterProfesseur, retirerAffectationProfesseur,
};
