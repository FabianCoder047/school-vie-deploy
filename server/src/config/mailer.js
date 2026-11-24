// Envoi de mail — deux transporteurs :
//  - 'smtp'  : Nodemailer (Gmail, port 587/465). Bloqué sur Render gratuit.
//  - 'resend': API HTTPS (https://api.resend.com/emails), fonctionne partout.
// MAIL_DRY_RUN=true affiche le mail dans la console au lieu de l'envoyer.
const nodemailer = require('nodemailer');
const env = require('./env');
const logger = require('../utils/logger');

const transporter = !env.smtp.dryRun && env.smtp.provider !== 'resend'
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

async function envoyerAvecResend({ to, subject, html }) {
  if (!env.smtp.resendApiKey) {
    throw new Error('RESEND_API_KEY manquante (MAIL_PROVIDER=resend).');
  }
  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.smtp.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.smtp.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`Resend ${reponse.status} : ${detail.slice(0, 300)}`);
  }
}

/**
 * Envoie un mail.
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
  if (env.smtp.provider === 'resend') {
    await envoyerAvecResend({ to, subject, html });
  } else {
    await transporter.sendMail({ from: env.smtp.from, to, subject, html });
  }
  return { delivered: true, dryRun: false };
}

module.exports = { sendMail };
