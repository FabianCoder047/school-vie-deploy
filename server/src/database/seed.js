// =====================================================================
// Seed volontairement minimal :
//  - le compte Administrateur (e-mail / mot de passe lus dans .env)
//  - 1 cycle (Primaire), 3 classes (CP1, CP2, CE1)
//  - 1 année académique courante (calculée depuis la date du jour)
//  - la ligne school_settings (id = 1)
// Idempotent : peut être relancé sans doublonner.
// =====================================================================
require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'school_vie_db_004774',
  });

  try {
    // --- Année académique courante : 1er septembre → 30 juin ---
    const now = new Date();
    const yearStart = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const libelle = `${yearStart}-${yearStart + 1}`;
    const dateDebut = `${yearStart}-09-01`;
    const dateFin = `${yearStart + 1}-06-30`;

    await connection.query(
      `INSERT INTO academic_years (libelle, date_debut, date_fin, is_current)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE is_current = 1, date_debut = VALUES(date_debut), date_fin = VALUES(date_fin)`,
      [libelle, dateDebut, dateFin]
    );
    console.log(`Année académique courante : ${libelle}`);

    // --- School settings (ligne unique id = 1) ---
    await connection.query(
      `INSERT INTO school_settings (id, nom, devise, note_max, duree_heure_minutes)
       VALUES (1, ?, 'FCFA', 20.00, 55)
       ON DUPLICATE KEY UPDATE nom = VALUES(nom)`,
      [process.env.SCHOOL_NAME || 'School Vie']
    );
    console.log('school_settings : ligne id=1 prête.');

    // --- Cycle + classes ---
    await connection.query(
      `INSERT INTO cycles (nom, description, ordre) VALUES ('Primaire', 'Enseignement primaire', 1)
       ON DUPLICATE KEY UPDATE nom = VALUES(nom)`
    );
    const [[cycle]] = await connection.query(`SELECT id FROM cycles WHERE nom = 'Primaire'`);

    const classes = ['CP1', 'CP2', 'CE1'];
    for (let i = 0; i < classes.length; i++) {
      await connection.query(
        `INSERT INTO classes (cycle_id, nom, ordre) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE ordre = VALUES(ordre)`,
        [cycle.id, classes[i], i + 1]
      );
    }
    console.log('Cycle « Primaire » + classes CP1, CP2, CE1 prêts.');

    // --- Compte Administrateur (depuis .env) ---
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans server/.env');
    }
    const [[existing]] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [adminEmail]
    );
    if (existing) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await connection.query(
        'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
        [hash, existing.id]
      );
      console.log(`Administrateur ${adminEmail} : mot de passe réinitialisé depuis .env (changement obligatoire à la prochaine connexion).`);
    } else {
      const hash = await bcrypt.hash(adminPassword, 12);
      await connection.query(
        `INSERT INTO users (role, nom, prenom, email, password_hash, must_change_password, is_active)
         VALUES ('ADMIN', ?, ?, ?, ?, 1, 1)`,
        [
          process.env.ADMIN_NOM || 'Administrateur',
          process.env.ADMIN_PRENOM || 'École',
          adminEmail,
          hash,
        ]
      );
      console.log(`Compte Administrateur créé : ${adminEmail} (changement de mot de passe obligatoire).`);
    }

    console.log('Seed terminé.');
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error('Échec du seed :', err.message);
  process.exit(1);
});
