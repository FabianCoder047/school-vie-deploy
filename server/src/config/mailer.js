// Transport Nodemailer (Gmail via SMTP) avec mode « dry-run » :
// MAIL_DRY_RUN=true affiche le mail dans la console au lieu de l'envoyer.
const nodemailer = require('nodemailer');
const env = require('./env');
const logger = require('../utils/logger');

const transporter = env.smtp.dryRun
  ? null
  : nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });

/**
 * Envoie un mail. En mode dry-run, affiche tout dans la console.
 * @returns {Promise<{delivered: boolean, dryRun: boolean}>}
 */
async function sendMail({ to, subject, html }) {
  if (env.smtp.dryRun) {
    logger.info('--- MAIL (dry-run, non envoyé) ---');
    logger.info(`À: ${to}`);
    logger.info(`Objet: ${subject}`);
    logger.info(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    logger.info('-----------------------------------');
    return { delivered: false, dryRun: true };
  }
  await transporter.sendMail({ from: env.smtp.from, to, subject, html });
  return { delivered: true, dryRun: false };
}

module.exports = { sendMail };
