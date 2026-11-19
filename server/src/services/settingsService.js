// Paramètres de l'école : lecture (tout rôle connecté) et modification
// (Admin uniquement) + uploads logo, signature du directeur, cachet (Admin).
const path = require('path');
const fs = require('fs');
const { ApiError } = require('../utils/ApiError');
const settingsRepo = require('../repositories/settingsRepository');
const { log: audit } = require('../repositories/auditRepository');
const horaires = require('../config/horairesScolaires');

const DOSSIER_UPLOADS = path.join(__dirname, '..', '..', 'uploads');
const URL_PUBLIQUE = '/uploads';

async function lireParametres() {
  const settings = await settingsRepo.get();
  if (!settings) throw ApiError.notFound('Paramètres de l’école non initialisés. Lancez npm run seed.');
  return settings;
}

async function modifierParametres(data, actorId, ip) {
  if (!data.nom || !data.nom.trim()) {
    throw ApiError.badRequest('Le nom de l’école est requis.', 'NOM_REQUIS');
  }
  if (!(Number(data.note_max) > 0)) {
    throw ApiError.badRequest('La note maximale doit être un nombre positif.', 'NOTE_MAX_INVALIDE');
  }
  if (!(Number(data.duree_heure_minutes) >= 1)) {
    throw ApiError.badRequest('La durée d’une heure de cours doit être d’au moins 1 minute.', 'DUREE_INVALIDE');
  }

  // Cohérence de la journée type (les heures viennent du schéma Zod, mais on
  // revérifie ici pour les appels directs au service).
  const champsHoraires = ['debut_journee', 'pause_matin_debut', 'pause_matin_fin', 'fin_matin', 'debut_apres_midi', 'fin_apres_midi', 'fin_primaire'];
  const h = {};
  for (const champ of champsHoraires) {
    const valeur = String(data[champ] ?? '').slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(valeur)) {
      throw ApiError.badRequest(`Heure invalide pour ${champ} (format HH:MM attendu).`, 'HORAIRE_INVALIDE');
    }
    h[champ] = valeur;
  }
  const m = horaires.enMinutes;
  if (!(m(h.debut_journee) < m(h.pause_matin_debut) && m(h.pause_matin_debut) < m(h.pause_matin_fin)
    && m(h.pause_matin_fin) < m(h.fin_matin) && m(h.fin_matin) < m(h.debut_apres_midi)
    && m(h.debut_apres_midi) < m(h.fin_apres_midi))) {
    throw ApiError.badRequest('Les horaires doivent être ordonnés : début < pause < fin de matinée < retour < fin de l’après-midi.', 'HORAIRES_DESORDONNES');
  }
  if (!(m(h.pause_matin_fin) < m(h.fin_primaire) && m(h.fin_primaire) <= m(h.fin_matin))) {
    throw ApiError.badRequest('Au primaire, la fin doit être comprise entre la fin de la pause et la fin de matinée.', 'FIN_PRIMAIRE_INVALIDE');
  }

  const avant = await settingsRepo.get();
  const settings = await settingsRepo.update({
    nom: data.nom.trim(),
    adresse: data.adresse?.trim() || null,
    bp: data.bp?.trim() || null,
    ville: data.ville?.trim() || null,
    pays: data.pays?.trim() || null,
    telephone: data.telephone?.trim() || null,
    email: data.email?.trim() || null,
    directeur_nom: data.directeur_nom?.trim() || null,
    devise: (data.devise || 'FCFA').trim(),
    note_max: Number(data.note_max),
    duree_heure_minutes: Number(data.duree_heure_minutes),
    debut_journee: h.debut_journee,
    pause_matin_debut: h.pause_matin_debut,
    pause_matin_fin: h.pause_matin_fin,
    fin_matin: h.fin_matin,
    debut_apres_midi: h.debut_apres_midi,
    fin_apres_midi: h.fin_apres_midi,
    fin_primaire: h.fin_primaire,
  });
  await audit({ userId: actorId, action: 'UPDATE', entity: 'school_settings', entityId: 1, oldValues: avant, newValues: data, ipAddress: ip });
  return settings;
}

/** Enregistre le logo uploadé et remplace l'ancien fichier le cas échéant. */
async function definirLogo(fichier, actorId, ip) {
  return definirImage({ fichier, actorId, ip, champ: 'logo_path', dossier: 'logo', action: 'UPDATE_LOGO' });
}

/** Enregistre la signature du directeur uploadée (fichier déjà sur disque). */
async function definirSignature(fichier, actorId, ip) {
  return definirImage({ fichier, actorId, ip, champ: 'signature_path', dossier: 'signature', action: 'UPDATE_SIGNATURE', update: settingsRepo.updateSignature });
}

/** Enregistre le chemin d'une signature dessinée dans l'application (PNG). */
async function definirSignaturePath(chemin, actorId, ip) {
  const avant = await settingsRepo.get();
  const ancien = avant?.signature_path;
  const settings = await settingsRepo.updateSignature(chemin);
  if (ancien && ancien.startsWith(`${URL_PUBLIQUE}/signature/`)) {
    fs.promises.unlink(path.join(DOSSIER_UPLOADS, 'signature', path.basename(ancien))).catch(() => {});
  }
  await audit({ userId: actorId, action: 'UPDATE_SIGNATURE', entity: 'school_settings', entityId: 1, ipAddress: ip });
  return settings;
}

/** Enregistre le cachet de l'établissement uploadé. */
async function definirCachet(fichier, actorId, ip) {
  return definirImage({ fichier, actorId, ip, champ: 'cachet_path', dossier: 'cachet', action: 'UPDATE_CACHET', update: settingsRepo.updateCachet });
}

/** Supprime la signature du directeur (fichier + colonne). */
async function supprimerSignature(actorId, ip) {
  return supprimerImage({ actorId, ip, champ: 'signature_path', dossier: 'signature', action: 'DELETE_SIGNATURE', update: settingsRepo.updateSignature });
}

/** Supprime le cachet de l'établissement (fichier + colonne). */
async function supprimerCachet(actorId, ip) {
  return supprimerImage({ actorId, ip, champ: 'cachet_path', dossier: 'cachet', action: 'DELETE_CACHET', update: settingsRepo.updateCachet });
}

/** Factorisation logo / signature / cachet : enregistre dans la colonne puis purge l'ancien fichier. */
async function definirImage({ fichier, actorId, ip, champ, dossier, action, update }) {
  if (!fichier) throw ApiError.badRequest('Aucun fichier reçu.', 'FICHIER_REQUIS');
  const avant = await settingsRepo.get();
  const ancien = avant?.[champ];
  const appliquer = update || settingsRepo.updateLogo;
  const nouveauChemin = `${URL_PUBLIQUE}/${dossier}/${fichier.filename}`;
  const settings = await appliquer(nouveauChemin);
  if (ancien && ancien.startsWith(`${URL_PUBLIQUE}/${dossier}/`)) {
    fs.promises.unlink(path.join(DOSSIER_UPLOADS, dossier, path.basename(ancien))).catch(() => {});
  }
  await audit({ userId: actorId, action, entity: 'school_settings', entityId: 1, ipAddress: ip });
  return settings;
}

/** Factorisation : vide la colonne puis supprime le fichier. */
async function supprimerImage({ actorId, ip, champ, dossier, action, update }) {
  const avant = await settingsRepo.get();
  const ancien = avant?.[champ];
  const settings = await update(null);
  if (ancien && ancien.startsWith(`${URL_PUBLIQUE}/${dossier}/`)) {
    fs.promises.unlink(path.join(DOSSIER_UPLOADS, dossier, path.basename(ancien))).catch(() => {});
  }
  await audit({ userId: actorId, action, entity: 'school_settings', entityId: 1, ipAddress: ip });
  return settings;
}

module.exports = { lireParametres, modifierParametres, definirLogo, definirCachet, definirSignature, definirSignaturePath, supprimerSignature, supprimerCachet, DOSSIER_UPLOADS, URL_PUBLIQUE };
