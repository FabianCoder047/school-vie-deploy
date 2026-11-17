// Contrôleur HTTP — comptes utilisateurs (Directeurs par l'Admin ;
// Secrétaire/Comptable/Professeur par le Directeur).
const service = require('../services/userManagementService');

/** Scope = périmètre de rôles autorisé pour l'appelant. */
async function lister(req, res, next) {
  try { res.json(await service.listerComptes(req.user.role, req.query)); } catch (e) { next(e); }
}

async function creer(req, res, next) {
  try {
    // Le rôle demandé doit être dans le périmètre de l'appelant (vérifié aussi côté service).
    const result = await service.creerCompte(req.user.role, req.user.id, req.body, req.ip);
    res.status(201).json(result);
  } catch (e) { next(e); }
}

async function setStatut(req, res, next) {
  try {
    const user = await service.setStatut(req.user.role, req.user.id, Number(req.params.id), req.body.is_active, req.ip);
    res.json({ user });
  } catch (e) { next(e); }
}

async function renvoyerIdentifiants(req, res, next) {
  try {
    const result = await service.renvoyerIdentifiants(req.user.role, req.user.id, Number(req.params.id), req.ip);
    res.json(result);
  } catch (e) { next(e); }
}

module.exports = { lister, creer, setStatut, renvoyerIdentifiants };
