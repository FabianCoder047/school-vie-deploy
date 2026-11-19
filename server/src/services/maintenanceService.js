// Fenêtre de maintenance définie par l'administrateur (de temps à temps).
// Pendant [maintenance_debut ; maintenance_fin[, toute l'application est
// inactive pour tout le monde SAUF le rôle ADMIN :
//  - le garde (middlewares/maintenanceGuard) renvoie 503 MAINTENANCE sur
//    tout le reste de l'API (et les fichiers /uploads non publics) ;
//  - la connexion / le refresh sont refusés aux non-admins au niveau service ;
//  - la fenêtre expire toute seule à maintenance_fin (aucun redémarrage).
// Lecture mise en cache 10 s (invalidée à chaque écriture) : le garde
// s'exécute sur chaque requête, il ne doit pas frapper la base à chaque fois.
const { ApiError } = require('../utils/ApiError');
const settingsRepo = require('../repositories/settingsRepository');
const { log: audit } = require('../repositories/auditRepository');

const MESSAGE_DEFAUT = 'Le site est en cours de maintenance. L’accès est temporairement suspendu. Merci de votre patience.';
const CACHE_TTL_MS = 10_000;

let cache = { valeur: null, expireA: 0 };

function invaliderCache() {
  cache = { valeur: null, expireA: 0 };
}

const dateOuNull = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Calcule l'état de la fenêtre à un instant donné. */
function calculerEtat(row, now = new Date()) {
  const debut = dateOuNull(row?.maintenance_debut);
  const fin = dateOuNull(row?.maintenance_fin);
  let etat = 'aucune';
  if (debut && fin) {
    if (now >= debut && now < fin) etat = 'active';
    else if (now < debut) etat = 'planifiee';
    else etat = 'terminee';
  }
  return {
    etat,
    active: etat === 'active',
    planifiee: etat === 'planifiee',
    debut,
    fin,
    message: (row?.maintenance_message || '').trim() || MESSAGE_DEFAUT,
    nom: row?.nom || 'School Vie',
    logo_path: row?.logo_path || null,
  };
}

async function lireEtat({ force = false } = {}) {
  if (!force && cache.valeur && Date.now() < cache.expireA) return cache.valeur;
  const row = await settingsRepo.getMaintenance();
  const valeur = calculerEtat(row);
  cache = { valeur, expireA: Date.now() + CACHE_TTL_MS };
  return valeur;
}

/** Test rapide utilisé par le garde et les services auth. */
async function estActive() {
  const etat = await lireEtat();
  return etat.active;
}

const iso = (d) => (d ? d.toISOString() : null);

function versPublic(etat) {
  return {
    active: etat.active,
    planifiee: etat.planifiee,
    etat: etat.etat,
    debut: iso(etat.debut),
    fin: iso(etat.fin),
    message: etat.message,
    etablissement: { nom: etat.nom, logo_path: etat.logo_path },
  };
}

/** Statut public (page de maintenance, sondage du front) — sans aucune donnée sensible. */
async function statutPublic() {
  return versPublic(await lireEtat());
}

/** Configuration complète pour l'administrateur (toujours fraîche). */
async function configAdmin() {
  return versPublic(await lireEtat({ force: true }));
}

/** Définit (ou remplace) la fenêtre de maintenance. */
async function definirPeriode({ debut, fin, message }, actorId, ip) {
  const d = new Date(debut);
  const f = new Date(fin);
  if (Number.isNaN(d.getTime()) || Number.isNaN(f.getTime())) {
    throw ApiError.badRequest('Dates de début et de fin invalides.', 'MAINTENANCE_DATES_INVALIDES');
  }
  if (f <= d) {
    throw ApiError.badRequest('La fin de la maintenance doit être postérieure au début.', 'MAINTENANCE_FIN_AVANT_DEBUT');
  }
  const avant = await lireEtat({ force: true });
  const row = await settingsRepo.updateMaintenance({
    debut: d,
    fin: f,
    message: message?.trim() || null,
  });
  invaliderCache();
  await audit({
    userId: actorId,
    action: 'MAINTENANCE_DEFINIE',
    entity: 'school_settings',
    entityId: 1,
    oldValues: { debut: iso(avant.debut), fin: iso(avant.fin), message: avant.message },
    newValues: { debut: d.toISOString(), fin: f.toISOString(), message: message?.trim() || null },
    ipAddress: ip,
  });
  return versPublic(calculerEtat(row));
}

/** Termine la maintenance maintenant (la fin est ramenée à l'instant présent). */
async function terminerMaintenance(actorId, ip) {
  const row = await settingsRepo.arreterMaintenance();
  invaliderCache();
  await audit({
    userId: actorId,
    action: 'MAINTENANCE_ARRETEE',
    entity: 'school_settings',
    entityId: 1,
    newValues: { fin: new Date().toISOString() },
    ipAddress: ip,
  });
  return versPublic(calculerEtat(row));
}

module.exports = {
  MESSAGE_DEFAUT,
  lireEtat,
  estActive,
  statutPublic,
  configAdmin,
  definirPeriode,
  terminerMaintenance,
  invaliderCache,
};
