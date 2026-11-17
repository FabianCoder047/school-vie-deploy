// Paramètres de l'école (ligne unique id = 1) + uploads (logo, signature, cachet).
const pool = require('../config/db');

const PUBLIC = 'id, nom, logo_path, adresse, bp, ville, pays, telephone, email, directeur_nom, signature_path, cachet_path, devise, note_max, duree_heure_minutes';

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

async function updateCachet(cachetPath) {
  await pool.query('UPDATE school_settings SET cachet_path = ? WHERE id = 1', [cachetPath]);
  return get();
}

module.exports = { get, update, updateLogo, updateSignature, updateCachet };
