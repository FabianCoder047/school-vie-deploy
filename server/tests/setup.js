// =====================================================================
// Tests d'intégration — base de test jetable (school_vie_test_db_004774).
// La base est créée, migrée et seedée au début de la suite puis SUPPRIMÉE
// à la fin. Les tests sont exécutés contre l'application Express réelle
// (pas besoin de serveur HTTP en écoute — supertest utilise l'app).
// =====================================================================
const { execFileSync } = require('child_process');
const path = require('path');
// Charge server/.env (DB_USER, DB_PASSWORD, secrets…) AVANT de surcharger
// avec des valeurs de test (dotenv n'écrase pas les variables déjà définies).
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const request = require('supertest');

// Base jetable par défaut ; un test peut surcharger via TEST_DB_NAME
// (utile pour les suites d'intégration exécutées en parallèle).
process.env.DB_NAME = process.env.TEST_DB_NAME || 'school_vie_test_db_004774';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'AdminTest2026!';
process.env.ADMIN_NOM = 'AdminTest';
process.env.ADMIN_PRENOM = 'Test';
process.env.SCHOOL_NAME = 'École de Test';
process.env.MAIL_DRY_RUN = 'true';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-' + 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-' + 'b'.repeat(40);
process.env.LOGIN_MAX_ATTEMPTS = '5';
process.env.LOGIN_LOCK_MINUTES = '30';

const mysql = require('mysql2/promise');

async function query(sql, params = [], withDb = true) {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  if (withDb) config.database = process.env.DB_NAME || 'school_vie_test_db_004774';
  const conn = await mysql.createConnection(config);
  try {
    return await conn.query(sql, params);
  } finally {
    await conn.end();
  }
}

/** Crée la base, joue les migrations et le seed. */
async function creerBase() {
  await query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``, [], false);
  execFileSync('node', [path.join(__dirname, '..', 'src', 'database', 'migrate.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    stdio: 'pipe',
  });
  execFileSync('node', [path.join(__dirname, '..', 'src', 'database', 'seed.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    stdio: 'pipe',
  });
}

/** Supprime la base de test. */
async function supprimerBase() {
  await query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``, [], false);
}

function app() {
  delete require.cache[require.resolve('../src/app')];
  return require('../src/app');
}

module.exports = { creerBase, supprimerBase, app, query, request };
