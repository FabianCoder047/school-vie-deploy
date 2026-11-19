// Paramètres de l'école (ligne unique id = 1) + uploads (logo, signature, cachet).
const pool = require('../config/db');

const PUBLIC = 'id, nom, logo_path, adresse, bp, ville, pays, telephone, email, directeur_nom, signature_path, cachet_path, devise, note_max, duree_heure_minutes, cartes_impression_autorisee, bulletins_impression_autorisee';

async function get() {
  const [[row]] = await pool.query(`SELECT ${PUBLIC} FROM school_settings WHERE id = 1`);
  return row || null;
}

async function update({ nom, adresse, bp, ville, pays, telephone, email, directeur_nom, devise, note_max, duree_heure_minutes }) {
  await pool.query(
    `UPDATE school_settings
        SET nom = ?, adresse = ?, bp = ?, ville = ?, pays = ?, telephone = ?, email = ?, directeur_nom = ?, devise = ?, note_max = ?, duree_heure_minutes = ?
      WHERE id = 1`,
    [nom, adresse || null, bp || null, ville || null, pays || null, telephone || null, email || null, directeur_nom || null, devise, note_max, duree_heure_minutes]
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
 *  d'impression des cartes ou des bulletins par la secrétaire. */
async function setAutorisationImpression(type, autorisee) {
  const colonne = type === 'cartes' ? 'cartes_impression_autorisee' : 'bulletins_impression_autorisee';
  await pool.query(`UPDATE school_settings SET ${colonne} = ? WHERE id = 1`, [autorisee ? 1 : 0]);
  return get();
}

async function updateCachet(cachetPath) {
  await pool.query('UPDATE school_settings SET cachet_path = ? WHERE id = 1', [cachetPath]);
  return get();
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

module.exports = { get, update, updateLogo, updateSignature, updateCachet, setAutorisationImpression, getMaintenance, updateMaintenance, arreterMaintenance };
