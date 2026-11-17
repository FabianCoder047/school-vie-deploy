// Contrôleur HTTP — référentiels (cycles, classes, matières, années).
const service = require('../services/referentielService');

/* CYCLES */
async function listerCycles(req, res, next) {
  try { res.json(await service.listerCycles(req.query)); } catch (e) { next(e); }
}
async function creerCycle(req, res, next) {
  try { res.status(201).json(await service.creerCycle(req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function modifierCycle(req, res, next) {
  try { res.json(await service.modifierCycle(Number(req.params.id), req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function supprimerCycle(req, res, next) {
  try { res.json(await service.supprimerCycle(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}

/* CLASSES */
async function listerClasses(req, res, next) {
  try { res.json(await service.listerClasses(req.query)); } catch (e) { next(e); }
}
async function listerToutesLesClasses(_req, res, next) {
  try { res.json(await service.listerToutesLesClasses()); } catch (e) { next(e); }
}
async function creerClasse(req, res, next) {
  try { res.status(201).json(await service.creerClasse(req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function modifierClasse(req, res, next) {
  try { res.json(await service.modifierClasse(Number(req.params.id), req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function supprimerClasse(req, res, next) {
  try { res.json(await service.supprimerClasse(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}

/* MATIÈRES */
async function listerMatieres(req, res, next) {
  try { res.json(await service.listerMatieres(req.query)); } catch (e) { next(e); }
}
async function listerToutesLesMatieres(_req, res, next) {
  try { res.json(await service.listerToutesLesMatieres()); } catch (e) { next(e); }
}
async function creerMatiere(req, res, next) {
  try { res.status(201).json(await service.creerMatiere(req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function modifierMatiere(req, res, next) {
  try { res.json(await service.modifierMatiere(Number(req.params.id), req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function supprimerMatiere(req, res, next) {
  try { res.json(await service.supprimerMatiere(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}

/* ANNÉES ACADÉMIQUES */
async function listerAnnees(req, res, next) {
  try { res.json(await service.listerAnnees(req.query)); } catch (e) { next(e); }
}
async function listerToutesLesAnnees(_req, res, next) {
  try { res.json(await service.listerToutesLesAnnees()); } catch (e) { next(e); }
}
async function anneeCourante(_req, res, next) {
  try { res.json(await service.anneeCourante()); } catch (e) { next(e); }
}
async function creerAnnee(req, res, next) {
  try { res.status(201).json(await service.creerAnnee(req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function modifierAnnee(req, res, next) {
  try { res.json(await service.modifierAnnee(Number(req.params.id), req.body, req.user.id, req.ip)); } catch (e) { next(e); }
}
async function definirAnneeCourante(req, res, next) {
  try { res.json(await service.definirAnneeCourante(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}
async function supprimerAnnee(req, res, next) {
  try { res.json(await service.supprimerAnnee(Number(req.params.id), req.user.id, req.ip)); } catch (e) { next(e); }
}

module.exports = {
  listerCycles, creerCycle, modifierCycle, supprimerCycle,
  listerClasses, listerToutesLesClasses, creerClasse, modifierClasse, supprimerClasse,
  listerMatieres, listerToutesLesMatieres, creerMatiere, modifierMatiere, supprimerMatiere,
  listerAnnees, listerToutesLesAnnees, anneeCourante, creerAnnee, modifierAnnee, definirAnneeCourante, supprimerAnnee,
};
