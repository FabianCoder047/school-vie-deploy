// Périodes d'évaluation (Trimestre 1/2/3, Semestre 1/2) + fenêtre de saisie.
const pool = require('../config/db');

async function listByYear(academicYearId) {
  const [rows] = await pool.query(
    `SELECT id, academic_year_id, libelle, ordre, date_debut, date_fin, saisie_debut, saisie_fin
       FROM evaluation_periods
      WHERE academic_year_id = ? ORDER BY ordre`,
    [academicYearId]
  );
  return rows;
}

async function findById(id) {
  const [[row]] = await pool.query(
    'SELECT id, academic_year_id, libelle, ordre, date_debut, date_fin, saisie_debut, saisie_fin FROM evaluation_periods WHERE id = ?',
    [id]
  );
  return row || null;
}

async function create({ academic_year_id, libelle, ordre, date_debut, date_fin, saisie_debut, saisie_fin }) {
  const [result] = await pool.query(
    `INSERT INTO evaluation_periods (academic_year_id, libelle, ordre, date_debut, date_fin, saisie_debut, saisie_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [academic_year_id, libelle, ordre, date_debut, date_fin, saisie_debut || null, saisie_fin || null]
  );
  return findById(result.insertId);
}

async function update(id, { libelle, ordre, date_debut, date_fin, saisie_debut, saisie_fin }) {
  await pool.query(
    'UPDATE evaluation_periods SET libelle = ?, ordre = ?, date_debut = ?, date_fin = ?, saisie_debut = ?, saisie_fin = ? WHERE id = ?',
    [libelle, ordre, date_debut, date_fin, saisie_debut || null, saisie_fin || null, id]
  );
  return findById(id);
}

async function compterNotes(id) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM grades WHERE evaluation_period_id = ?', [id]);
  return total;
}

async function remove(id) {
  await pool.query('DELETE FROM evaluation_periods WHERE id = ?', [id]);
}

/** Fenêtre de saisie courante pour la période (null si non ouverte). */
function fenetreSaisie(periode) {
  if (!periode) return { ouverte: false, motif: 'Période introuvable.' };
  // Une période sans fenêtre de saisie définie est FERMÉE par défaut :
  // le Directeur ouvre la saisie explicitement (et une seule période peut
  // être ouverte à la fois — la validation chevauchement est côté service).
  if (!periode.saisie_debut && !periode.saisie_fin) {
    return { ouverte: false, motif: 'Fenêtre de saisie non définie — la saisie des notes est fermée par défaut.' };
  }
  const maintenant = new Date();
  if (periode.saisie_debut && new Date(periode.saisie_debut) > maintenant) {
    return { ouverte: false, motif: `La saisie ouvre le ${new Date(periode.saisie_debut).toLocaleString('fr-FR')}.`, ouverture: periode.saisie_debut, fermeture: periode.saisie_fin };
  }
  if (periode.saisie_fin && new Date(periode.saisie_fin) < maintenant) {
    return { ouverte: false, motif: `La saisie est close depuis le ${new Date(periode.saisie_fin).toLocaleString('fr-FR')}.`, ouverture: periode.saisie_debut, fermeture: periode.saisie_fin };
  }
  return { ouverte: true, ouverture: periode.saisie_debut, fermeture: periode.saisie_fin };
}

module.exports = { listByYear, findById, create, update, compterNotes, remove, fenetreSaisie };
