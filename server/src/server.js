// Point d'entrée : vérifie la connexion MySQL puis écoute.
const env = require('./config/env');
const pool = require('./config/db');
const logger = require('./utils/logger');
const app = require('./app');

(async () => {
  try {
    await pool.query('SELECT 1');
    logger.info('Connexion à MySQL établie.');
  } catch (err) {
    logger.error('Impossible de se connecter à MySQL au démarrage.', { message: err.message });
    process.exit(1);
  }

  app.listen(env.port, () => {
    logger.info(`API School Vie à l'écoute sur http://localhost:${env.port}`);
  });
})();
