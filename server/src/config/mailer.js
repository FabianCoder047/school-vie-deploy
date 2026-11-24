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
      // Sans ces timeouts, un port SMTP bloqué (Render gratuit) fait attendre
      // la requête HTTP plusieurs minutes avant de journaliser l'erreur.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

/** Brevo via API HTTPS (pas de port SMTP → fonctionne sur Render gratuit). */
async function envoyerAvecBrevo({ to, subject, html }) {
  if (!env.smtp.brevoApiKey) {
    throw new Error('BREVO_API_KEY manquante (MAIL_PROVIDER=brevo).');
  }
  const correspondance = /^(.*?)\s*<([^>]+)>$/.exec(env.smtp.from);
  const sender = correspondance
    ? { name: correspondance[1].trim(), email: correspondance[2].trim() }
    : { name: env.smtp.from.includes('@') ? 'School Vie' : env.smtp.from, email: env.smtp.from };
  const destinataires = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));
  const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.smtp.brevoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: destinataires,
      subject,
      htmlContent: html,
    }),
  });
  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`Brevo ${reponse.status} : ${detail.slice(0, 300)}`);
  }
}

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
  } else if (env.smtp.provider === 'brevo') {
    await envoyerAvecBrevo({ to, subject, html });
  } else {
    await transporter.sendMail({ from: env.smtp.from, to, subject, html });
  }
  return { delivered: true, dryRun: false };
}

module.exports = { sendMail };
