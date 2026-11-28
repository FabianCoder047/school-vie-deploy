// =====================================================================
// Référentiels de base intégrés au snapshot MySQL au BUILD :
//  - année académique courante
//  - Paramètres de l'école (horaires : 07:00, pause 09:45–10:10,
//    12:00, retour 14:30, fin primaire 11:30, 1 h = 55 min)
//  - cycle Primaire + classes CP1, CP2, CE1
//
// Aucun compte utilisateur n'est créé ici : c'est ensure-admins.js qui
// garantit les admins au RUNTIME, sans embarquer de mot de passe.
// =====================================================================
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'school_vie_db_004774',
    ...(String(process.env.DB_SSL || 'false') === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    const now = new Date();
    const yearStart = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const libelle = `${yearStart}-${yearStart + 1}`;

    await connection.query(
      `INSERT INTO academic_years (libelle, date_debut, date_fin, is_current)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE is_current = 1, date_debut = VALUES(date_debut), date_fin = VALUES(date_fin)`,
      [libelle, `${yearStart}-09-01`, `${yearStart + 1}-06-30`]
    );

    await connection.query(
      `INSERT INTO school_settings
         (id, nom, devise, note_max, duree_heure_minutes, debut_journee, pause_matin_debut,
          pause_matin_fin, fin_matin, debut_apres_midi, fin_apres_midi, fin_primaire)
       VALUES (1, ?, 'FCFA', 20.00, 55, '07:00', '09:45', '10:10', '12:00', '14:30', '17:30', '11:30')
       ON DUPLICATE KEY UPDATE nom = VALUES(nom)`,
      [process.env.SCHOOL_NAME || 'School Vie']
    );

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
    console.log(`Référentiels intégrés : ${libelle}, ${classes.join(', ')}.`);
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error('Échec des référentiels :', err.message);
  process.exit(1);
});
