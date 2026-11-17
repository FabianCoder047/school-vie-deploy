// Élèves et tuteurs — accès données brut.
const pool = require('../config/db');

/* ===== TUTEURS ===== */
async function findGuardianByPhone(telephone) {
  const [[row]] = await pool.query('SELECT id, user_id, nom, prenom, telephone_whatsapp, email FROM guardians WHERE telephone_whatsapp = ?', [telephone]);
  return row || null;
}

async function createGuardian({ nom, prenom, telephone_whatsapp, email }, conn = null) {
  const db = conn || pool;
  const [result] = await db.query(
    'INSERT INTO guardians (nom, prenom, telephone_whatsapp, email) VALUES (?, ?, ?, ?)',
    [nom, prenom, telephone_whatsapp, email || null]
  );
  const [[row]] = await db.query('SELECT id, user_id, nom, prenom, telephone_whatsapp, email FROM guardians WHERE id = ?', [result.insertId]);
  return row;
}

async function linkGuardianToUser(guardianId, userId, conn = null) {
  const db = conn || pool;
  await db.query('UPDATE guardians SET user_id = ? WHERE id = ?', [userId, guardianId]);
}

async function updateGuardian(id, { nom, prenom, telephone_whatsapp, email }) {
  await pool.query(
    'UPDATE guardians SET nom = ?, prenom = ?, telephone_whatsapp = ?, email = ? WHERE id = ?',
    [nom, prenom, telephone_whatsapp, email || null, id]
  );
}

/* ===== ÉLÈVES ===== */
async function createStudent({ matricule, nom, prenom, sexe, date_naissance, lieu_naissance, adresse, guardian_id }, conn = null) {
  const db = conn || pool;
  const [result] = await db.query(
    `INSERT INTO students (matricule, nom, prenom, sexe, date_naissance, lieu_naissance, adresse, guardian_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [matricule, nom, prenom, sexe || null, date_naissance, lieu_naissance, adresse, guardian_id]
  );
  return result.insertId;
}

async function findById(id) {
  const [[row]] = await pool.query(
    `SELECT s.*, g.nom AS tuteur_nom, g.prenom AS tuteur_prenom, g.telephone_whatsapp AS tuteur_whatsapp,
            g.email AS tuteur_email, g.user_id AS parent_user_id
       FROM students s JOIN guardians g ON g.id = s.guardian_id
      WHERE s.id = ?`,
    [id]
  );
  return row || null;
}

async function updatePhoto(id, photoPath) {
  await pool.query('UPDATE students SET photo_path = ? WHERE id = ?', [photoPath, id]);
}

async function updateStudent(id, { nom, prenom, sexe, date_naissance, lieu_naissance, adresse }) {
  await pool.query(
    'UPDATE students SET nom = ?, prenom = ?, sexe = ?, date_naissance = ?, lieu_naissance = ?, adresse = ? WHERE id = ?',
    [nom, prenom, sexe || null, date_naissance, lieu_naissance, adresse, id]
  );
}

module.exports = {
  findGuardianByPhone, createGuardian, linkGuardianToUser, updateGuardian,
  createStudent, findById, updatePhoto, updateStudent,
};
