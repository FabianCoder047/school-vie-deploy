// Paramètres de l'école (ligne unique id = 1) + uploads (logo, signature, cachet).
const pool = require('../config/db');

const PUBLIC = 'id, nom, logo_path, adresse, bp, ville, pays, telephone, email, directeur_nom, signature_path, cachet_path, devise, note_max, duree_heure_minutes, debut_journee, pause_matin_debut, pause_matin_fin, fin_matin, debut_apres_midi, fin_apres_midi, fin_primaire, cartes_impression_autorisee, bulletins_impression_autorisee, proclamations_impression_autorisee, edts_impression_autorisee, matieres_secretaire_autorisee, affectations_secretaire_autorisee, annees_secretaire_autorisee, inscriptions_comptable_autorisee, paiements_secretaire_autorisee';

const CLES_DELEGATION = [
  'matieres_secretaire_autorisee',
  'affectations_secretaire_autorisee',
  'annees_secretaire_autorisee',
  'inscriptions_comptable_autorisee',
  'paiements_secretaire_autorisee',
];

async function get() {
  const [[row]] = await pool.query(`SELECT ${PUBLIC} FROM school_settings WHERE id = 1`);
  return row || null;
}

async function update({
  nom, adresse, bp, ville, pays, telephone, email, directeur_nom, devise, note_max, duree_heure_minutes,
  debut_journee, pause_matin_debut, pause_matin_fin, fin_matin, debut_apres_midi, fin_apres_midi, fin_primaire,
}) {
  await pool.query(
    `UPDATE school_settings
        SET nom = ?, adresse = ?, bp = ?, ville = ?, pays = ?, telephone = ?, email = ?, directeur_nom = ?,
            devise = ?, note_max = ?, duree_heure_minutes = ?, debut_journee = ?, pause_matin_debut = ?,
            pause_matin_fin = ?, fin_matin = ?, debut_apres_midi = ?, fin_apres_midi = ?, fin_primaire = ?
      WHERE id = 1`,
    [nom, adresse || null, bp || null, ville || null, pays || null, telephone || null, email || null, directeur_nom || null,
      devise, note_max, duree_heure_minutes, debut_journee, pause_matin_debut, pause_matin_fin, fin_matin,
      debut_apres_midi, fin_apres_midi, fin_primaire]
  );
  return get();
}

async function updateLogo(logoPath) {
  await pool.query('UPDATE school_settings SET logo_path = ? WHERE id = 1', [logoPath]);
  return get();
}

async function updateSignature(signaturePath) {
  await pool.query('UPDATE school_settings SET signature_path = ? WHERE id = 1', [signaturePath]);
  return get();
}

/** Feu vert du directeur : autorisation (permanente, activable/désactivable)
 *  d'impression des cartes, bulletins, fiches de proclamation ou EDT par la secrétaire. */
async function setAutorisationImpression(type, autorisee) {
  const colonnes = {
    cartes: 'cartes_impression_autorisee',
    bulletins: 'bulletins_impression_autorisee',
    proclamations: 'proclamations_impression_autorisee',
    edts: 'edts_impression_autorisee',
  };
  const colonne = colonnes[type];
  if (!colonne) throw new Error(`Type d’autorisation inconnu : ${type}`);
  await pool.query(`UPDATE school_settings SET ${colonne} = ? WHERE id = 1`, [autorisee ? 1 : 0]);
  return get();
}

async function updateCachet(cachetPath) {
  await pool.query('UPDATE school_settings SET cachet_path = ? WHERE id = 1', [cachetPath]);
  return get();
}

/* --- Délégations de tâches (interrupteurs pilotés par le Directeur) --- */

/** Lecture des 5 indicateurs de délégation (utilisée par le middleware et le front). */
async function lireDelegations() {
  const [[row]] = await pool.query(
    `SELECT ${CLES_DELEGATION.join(', ')} FROM school_settings WHERE id = 1`
  );
  if (!row) return null;
  const resultat = {};
  for (const cle of CLES_DELEGATION) resultat[cle] = Boolean(row[cle]);
  return resultat;
}

/** Enregistre tout ou partie des indicateurs de délégation. */
async function updateDelegations(valeurs) {
  const presents = CLES_DELEGATION.filter((cle) => Object.prototype.hasOwnProperty.call(valeurs, cle));
  if (presents.length === 0) return lireDelegations();
  await pool.query(
    `UPDATE school_settings SET ${presents.map((cle) => `${cle} = ?`).join(', ')} WHERE id = 1`,
    presents.map((cle) => (valeurs[cle] ? 1 : 0))
  );
  return lireDelegations();
}

/* --- Fenêtre de maintenance (colonnes 007_maintenance.sql) --- */

const MAINTENANCE = 'nom, logo_path, maintenance_debut, maintenance_fin, maintenance_message';

/** Lecture brute de la fenêtre de maintenance (plus nom/logo pour la page publique). */
async function getMaintenance() {
  const [[row]] = await pool.query(`SELECT ${MAINTENANCE} FROM school_settings WHERE id = 1`);
  return row || null;
}

/** Enregistre la fenêtre de maintenance (début, fin, message). */
async function updateMaintenance({ debut, fin, message }) {
  await pool.query(
    'UPDATE school_settings SET maintenance_debut = ?, maintenance_fin = ?, maintenance_message = ? WHERE id = 1',
    [debut, fin, message || null]
  );
  return getMaintenance();
}

/** Termine la maintenance immédiatement : la fin est ramenée à maintenant. */
async function arreterMaintenance() {
  await pool.query('UPDATE school_settings SET maintenance_fin = NOW() WHERE id = 1');
  return getMaintenance();
}

module.exports = {
  get, update, updateLogo, updateSignature, updateCachet, setAutorisationImpression,
  lireDelegations, updateDelegations, CLES_DELEGATION,
  getMaintenance, updateMaintenance, arreterMaintenance,
};
