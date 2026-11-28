// =====================================================================
// Garantit les comptes administrateurs après chaque démarrage.
// Contrairement au seed, il ne recrée pas les classes/années (déjà dans
// le snapshot de la base embarquée) et ne force PAS de changement de
// mot de passe. Il lève aussi les verrous de connexion.
// Idempotent : peut être relancé à chaque réveil du service.
// =====================================================================
require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const admins = [
  {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    nom: process.env.ADMIN_NOM || 'Administrateur',
    prenom: process.env.ADMIN_PRENOM || 'École',
  },
  {
    email: process.env.ADMIN2_EMAIL,
    password: process.env.ADMIN2_PASSWORD,
    nom: process.env.ADMIN2_NOM || 'Administrateur',
    prenom: process.env.ADMIN2_PRENOM || 'Vie',
  },
].filter((a) => a.email && a.password);

(async () => {
  if (admins.length === 0) {
    console.log('Aucun compte admin à garantir (ADMIN_EMAIL/ADMIN2_EMAIL absents).');
    return;
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'school_vie_db_004774',
    ...(String(process.env.DB_SSL || 'false') === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    for (const admin of admins) {
      const hash = await bcrypt.hash(admin.password, 12);
      const [[found]] = await connection.query('SELECT id FROM users WHERE email = ?', [admin.email]);
      if (found) {
        await connection.query(
          `UPDATE users SET password_hash = ?, role = 'ADMIN', is_active = 1,
             must_change_password = 0, failed_login_attempts = 0, locked_until = NULL
           WHERE id = ?`,
          [hash, found.id]
        );
        console.log(`Compte admin ${admin.email} : prêt (mot de passe défini, aucun verrou).`);
      } else {
        await connection.query(
          `INSERT INTO users (role, nom, prenom, email, password_hash, must_change_password, is_active,
                              failed_login_attempts, locked_until)
           VALUES ('ADMIN', ?, ?, ?, ?, 0, 1, 0, NULL)`,
          [admin.nom, admin.prenom, admin.email, hash]
        );
        console.log(`Compte admin ${admin.email} : créé (aucun verrou).`);
      }
    }

    // Sécurité : on s'assure qu'aucune fenêtre de maintenance ne verrouille l'accès.
    await connection.query(
      'UPDATE school_settings SET maintenance_debut = NULL, maintenance_fin = NULL WHERE id = 1'
    ).catch(() => {});
    console.log('Verrous de session levés.');
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error('Échec de la garantie des comptes admin :', err.message);
  process.exit(1);
});
