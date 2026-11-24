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

// Mail : on accepte les noms MAIL_* (port 465 implicite) et les anciens SMTP_*.
const mailHost = process.env.MAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
const mailPort = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || (process.env.MAIL_HOST ? 465 : 587));
const mailSecure = process.env.MAIL_SECURE
  ? String(process.env.MAIL_SECURE) === 'true'
  : (process.env.SMTP_SECURE ? String(process.env.SMTP_SECURE) === 'true' : mailPort === 465);
const mailFromBrut = process.env.MAIL_FROM || 'no-reply@school-vie.local';
const mailFromNom = process.env.MAIL_FROM_NAME || 'School Vie';
const mailFrom = mailFromBrut.includes('<') ? mailFromBrut : `${mailFromNom} <${mailFromBrut}>`;
// Les mots de passe d'application Gmail sont affichés avec des espaces : on les retire.
const mailPass = (process.env.MAIL_PASSORD || process.env.MAIL_PASSWORD || process.env.SMTP_PASS || '').replace(/\s+/g, '');

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
    // 'smtp' (Gmail/Brevo), 'resend' ou 'brevo' (API HTTPS — indispensable
    // sur les plans gratuits Render qui bloquent les ports SMTP 25/465/587).
    provider: String(process.env.MAIL_PROVIDER || 'smtp').toLowerCase(),
    resendApiKey: process.env.RESEND_API_KEY || '',
    brevoApiKey: process.env.BREVO_API_KEY || '',
    host: mailHost,
    port: mailPort,
    secure: mailSecure,
    user: process.env.MAIL_USERNAME || process.env.SMTP_USER || '',
    pass: mailPass,
    from: mailFrom,
    dryRun: String(process.env.MAIL_DRY_RUN || 'true') === 'true',
  },

  resetPassword: {
    url: process.env.RESET_PASSWORD_URL || 'http://localhost:5173/reinitialiser-mot-de-passe',
    expiresMinutes: Number(process.env.RESET_TOKEN_EXPIRES_MINUTES || 60),
  },
};
