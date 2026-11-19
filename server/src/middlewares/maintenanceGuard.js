// Garde de maintenance : exécuté sur TOUTES les requêtes (API, fichiers
// /uploads, etc.). Quand la fenêtre est active, tout le monde est refusé
// (503 MAINTENANCE) SAUF :
//  - quelques routes publiques indispensables (santé, statut maintenance) ;
//  - le logo de l'école (/uploads/logo/*) pour afficher la page de maintenance ;
//  - la connexion / déconnexion / le refresh (la connexion et le refresh
//    sont refusés aux non-admins plus loin, dans authService — un admin
//    peut donc toujours se connecter et garder sa session) ;
//  - les requêtes porteuses d'un access token ADMIN valide.
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const maintenanceService = require('../services/maintenanceService');
const logger = require('../utils/logger');

const ROUTES_PUBLIQUES = [
  { method: 'GET', re: /^\/api\/health\/?$/ },
  { method: 'GET', re: /^\/api\/maintenance\/status\/?$/ },
  { method: 'POST', re: /^\/api\/auth\/login\/?$/ },
  { method: 'POST', re: /^\/api\/auth\/logout\/?$/ },
  { method: 'POST', re: /^\/api\/auth\/refresh\/?$/ },
];

function estRoutePublique(req) {
  const chemin = (req.originalUrl || req.url || '').split('?')[0];
  if (req.method === 'GET' && chemin.startsWith('/uploads/logo/')) return true;
  return ROUTES_PUBLIQUES.some(({ method, re }) => method === req.method && re.test(chemin));
}

/** Rôle ADMIN porté par un access token valide ? (signature + expiration uniquement ;
 *  le contrôle complet — compte actif, mot de passe changé — reste fait par authenticate) */
function estAdmin(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return false;
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    return payload?.role === 'ADMIN';
  } catch (_err) {
    return false;
  }
}

async function maintenanceGuard(req, res, next) {
  try {
    const etat = await maintenanceService.lireEtat();
    if (!etat.active) return next();
    if (estRoutePublique(req)) return next();
    if (estAdmin(req)) return next();
    logger.info('Accès refusé (maintenance)', { method: req.method, path: req.originalUrl });
    return res.status(503).json({
      code: 'MAINTENANCE',
      message: etat.message,
      debut: etat.debut ? etat.debut.toISOString() : null,
      fin: etat.fin ? etat.fin.toISOString() : null,
    });
  } catch (err) {
    // État illisible (base injoignable…) : on reste EN FERMÉ — pendant une
    // maintenance le moindre doute profite à l'inactivité, tout en laissant
    // passer l'admin (la signature JWT ne nécessite pas la base).
    logger.error('Garde de maintenance : état illisible, accès refusé sauf admin.', { message: err?.message });
    if (estRoutePublique(req)) return next();
    if (estAdmin(req)) return next();
    return res.status(503).json({
      code: 'MAINTENANCE',
      message: maintenanceService.MESSAGE_DEFAUT,
      debut: null,
      fin: null,
    });
  }
}

module.exports = { maintenanceGuard };
