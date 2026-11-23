// Pool MySQL (mysql2/promise). Toutes les requêtes métier utilisent
// des requêtes préparées (placeholders ?) — jamais d'interpolation.
const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: false, // les DECIMAL restent des chaînes : aucun flottant sur les montants
  ...(env.db.ssl ? { ssl: env.db.ssl } : {}),
});

module.exports = pool;
