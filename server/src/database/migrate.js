// =====================================================================
// Système de migrations versionnées.
// Chaque fichier migrations/NNN_nom.sql est appliqué une seule fois,
// dans l'ordre alphabétique, et tracé dans la table schema_migrations.
// NB : le fichier 001_init.sql contient CREATE DATABASE + USE.
// =====================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Découpe un fichier .sql en instructions (le schéma n'utilise ni
// procédures stockées ni triggers : un simple split sur ";" suffit).
function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(--[^\n]*\n?)+$/.test(s));
}

(async () => {
  // MySQL managé : la base est créée à l'avance et l'utilisateur n'a pas le
  // droit CREATE DATABASE. On se connecte DIRECTEMENT à cette base et on ignore
  // les instructions CREATE DATABASE / USE de 001_init.sql.
  const baseDejaCreee = String(process.env.DB_SKIP_CREATE_DATABASE || 'false') === 'true';
  const dbName = process.env.DB_NAME || 'school_vie_db_004774';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: false,
    ...(baseDejaCreee ? { database: dbName } : {}),
    ...(String(process.env.DB_SSL || 'false') === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('Aucune migration trouvée.');
      return;
    }

    // Utilise la base si elle existe déjà (pour les migrations suivantes).
    try {
      await connection.query(`USE \`${process.env.DB_NAME || 'school_vie_db_004774'}\``);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);
    } catch (e) {
      if (e.code !== 'ER_BAD_DB_ERROR') throw e;
      // La base n'existe pas encore : 001_init.sql la créera.
    }

    const [appliedRows] = await connection
      .query('SELECT name FROM schema_migrations')
      .catch(() => [[]]);
    const applied = new Set(appliedRows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  ↷ ${file} (déjà appliquée)`);
        continue;
      }
      // Substitue le nom de base codé dans 001_init.sql par DB_NAME si différent
      let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      sql = sql.replace(/school_vie_db_004774/g, dbName);
      const statements = splitStatements(sql);
      console.log(`  → ${file} (${statements.length} instructions)`);

      for (const statement of statements) {
        if (baseDejaCreee && /^(CREATE DATABASE|USE)\s/i.test(statement)) continue;
        await connection.query(statement);
        // Après un CREATE DATABASE + USE, la session pointe sur la base.
        if (!baseDejaCreee && /^USE\s/i.test(statement)) {
          await connection.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
              name VARCHAR(255) PRIMARY KEY,
              applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
          `);
        }
      }
      await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.log(`  ✓ ${file} appliquée`);
    }
    console.log('Migrations terminées.');
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error('Échec des migrations :', err.message);
  process.exit(1);
});
