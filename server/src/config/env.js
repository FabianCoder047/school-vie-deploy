// Point d'accès unique à la configuration : valide la présence des
// variables indispensables au démarrage et échoue clairement sinon.
require('dotenv').config();
const path = require('path');

const required = ['DB_USER', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`Variables d'environnement manquantes : ${missing.join(', ')} (voir .env.example)`);
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Dossier des fichiers uploadés. En production Render, on le pointe vers
  // le disque persistant monté sur /data (voir render.yaml + DEPLOY.md).
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    // La plupart des MySQL managés (Aiven, Railway…) exigent TLS.
    ssl: String(process.env.DB_SSL || 'false') === 'true' ? { rejectUnauthorized: false } : undefined,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  login: {
    maxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS || 5),
    lockMinutes: Number(process.env.LOGIN_LOCK_MINUTES || 30),
  },

  smtp: {
    // 'smtp' (Gmail, etc.) ou 'resend' (API HTTPS — indispensable sur les
    // plans gratuits Render qui bloquent les ports SMTP 25/465/587).
    provider: String(process.env.MAIL_PROVIDER || 'smtp').toLowerCase(),
    resendApiKey: process.env.RESEND_API_KEY || '',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE) === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'School Vie <no-reply@school-vie.local>',
    dryRun: String(process.env.MAIL_DRY_RUN || 'true') === 'true',
  },

  resetPassword: {
    url: process.env.RESET_PASSWORD_URL || 'http://localhost:5173/reinitialiser-mot-de-passe',
    expiresMinutes: Number(process.env.RESET_TOKEN_EXPIRES_MINUTES || 60),
  },
};
