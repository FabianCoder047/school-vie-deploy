// =====================================================================
// Service d'authentification.
// Règles clés :
//  - identifiant = e-mail OU téléphone (insensible à la casse pour l'e-mail)
//  - réponse identique que l'identifiant existe ou non (pas de fuite)
//  - verrouillage après LOGIN_MAX_ATTEMPTS échecs, réouverture après
//    LOGIN_LOCK_MINUTES minutes (compteur remis à zéro à la connexion)
//  - refresh tokens : opaques, hachés SHA-256, rotatifs à chaque usage
// =====================================================================
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError } = require('../utils/ApiError');
const userRepo = require('../repositories/userRepository');
const refreshRepo = require('../repositories/refreshTokenRepository');
const resetRepo = require('../repositories/passwordResetRepository');
const audit = require('../repositories/auditRepository');
// Lecture de la fenêtre de maintenance (blocage login/refresh des non-admins).
const maintenanceService = require('./maintenanceService');
const { sendMail } = require('../config/mailer');
const { welcomeCredentialsTemplate } = require('../templates/welcomeCredentialsTemplate');
const { resetPasswordTemplate } = require('../templates/resetPasswordTemplate');
const logger = require('../utils/logger');

// Hash factice pour égaliser le temps de réponse quand l'identifiant n'existe pas.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function parseDurationMs(spec) {
  const match = /^(\d+)\s*([smhd])$/.exec(String(spec).trim());
  if (!match) return 7 * 24 * 3600 * 1000;
  const n = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return n * unit;
}

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

async function issueTokenPair(user, req) {
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const refreshExpiresAt = new Date(Date.now() + parseDurationMs(env.jwt.refreshExpiresIn));
  await refreshRepo.storeToken({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiresAt,
    userAgent: req?.headers?.['user-agent']?.slice(0, 250),
    ipAddress: req?.ip,
  });
  return { accessToken: signAccessToken(user), refreshToken };
}

function publicUser(user) {
  return {
    id: user.id,
    role: user.role,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    telephone: user.telephone,
    mustChangePassword: Boolean(user.must_change_password),
    lastLoginAt: user.last_login_at,
  };
}

async function login(identifier, password, req) {
  const user = await userRepo.findWithSecretsByIdentifier(identifier);

  // Compte verrouillé : message explicite avec les minutes restantes.
  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(user.locked_until) - Date.now()) / 60_000);
    await audit.log({ userId: user.id, action: 'LOGIN_BLOCKED', ipAddress: req?.ip });
    throw ApiError.locked(`Compte temporairement bloqué. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`, 'ACCOUNT_LOCKED');
  }

  // Comparaison bcrypt même si l'utilisateur n'existe pas (timing constant).
  const hash = user ? user.password_hash : DUMMY_HASH;
  const passwordOk = await bcrypt.compare(password, hash);

  if (!user || !passwordOk) {
    if (user) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      let lockUntil = null;
      if (attempts >= env.login.maxAttempts) {
        lockUntil = new Date(Date.now() + env.login.lockMinutes * 60_000);
        await audit.log({ userId: user.id, action: 'ACCOUNT_LOCKED', entity: 'users', entityId: user.id, ipAddress: req?.ip });
      }
      await userRepo.recordFailedLogin(user.id, attempts, lockUntil);
      await audit.log({ userId: user.id, action: 'LOGIN_FAILED', ipAddress: req?.ip });
    }
    throw ApiError.unauthorized('Identifiants invalides.', 'INVALID_CREDENTIALS');
  }

  if (!user.is_active) {
    throw ApiError.forbidden('Ce compte est désactivé. Contactez votre établissement.', 'ACCOUNT_DISABLED');
  }

  // Maintenance : seul l'administrateur peut se connecter.
  if (user.role !== 'ADMIN' && (await maintenanceService.estActive())) {
    await audit.log({ userId: user.id, action: 'MAINTENANCE_LOGIN_BLOCKED', ipAddress: req?.ip });
    throw ApiError.serviceUnavailable(
      'Le site est actuellement en maintenance. Seul l’administrateur peut se connecter — réessayez à la fin de la maintenance.',
      'MAINTENANCE'
    );
  }

  await userRepo.resetFailedLogin(user.id);
  await audit.log({ userId: user.id, action: 'LOGIN', ipAddress: req?.ip });

  const tokens = await issueTokenPair(user, req);
  return { ...tokens, user: publicUser(user) };
}

async function refresh(refreshTokenRaw, req) {
  if (!refreshTokenRaw) throw ApiError.unauthorized('Session expirée.', 'REFRESH_MISSING');
  const tokenHash = sha256(refreshTokenRaw);
  const found = await refreshRepo.findValidByHash(tokenHash);
  if (!found) throw ApiError.unauthorized('Session expirée. Veuillez vous reconnecter.', 'REFRESH_INVALID');
  if (!found.is_active) throw ApiError.forbidden('Ce compte est désactivé.', 'ACCOUNT_DISABLED');
  const existingUser = await userRepo.findById(found.user_id);
  if (!existingUser) throw ApiError.unauthorized('Session expirée. Veuillez vous reconnecter.', 'REFRESH_INVALID');

  // Maintenance : le refresh est réservé à l'administrateur.
  if (existingUser.role !== 'ADMIN' && (await maintenanceService.estActive())) {
    await audit.log({ userId: existingUser.id, action: 'MAINTENANCE_REFRESH_BLOCKED', ipAddress: req?.ip });
    throw ApiError.serviceUnavailable(
      'Le site est actuellement en maintenance. Seul l’administrateur peut se connecter.',
      'MAINTENANCE'
    );
  }

  // Rotation : l'ancien token est révoqué, un nouveau est émis.
  await refreshRepo.revokeByHash(tokenHash);
  const user = existingUser;
  const tokens = await issueTokenPair(user, req);
  return { ...tokens, user: publicUser(user) };
}

async function logout(refreshTokenRaw) {
  if (refreshTokenRaw) await refreshRepo.revokeByHash(sha256(refreshTokenRaw));
  return { success: true };
}

async function me(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw ApiError.notFound('Utilisateur introuvable.');
  return publicUser(user);
}

async function changePassword(userId, currentPassword, newPassword, req) {
  const secrets = await userRepo.findWithSecretsById(userId);
  if (!secrets) throw ApiError.notFound('Utilisateur introuvable.');

  const ok = await bcrypt.compare(currentPassword, secrets.password_hash);
  if (!ok) throw ApiError.badRequest('Mot de passe actuel incorrect.', 'CURRENT_PASSWORD_INVALID');

  const newHash = await bcrypt.hash(newPassword, 12);
  await userRepo.updatePassword(userId, newHash);
  await refreshRepo.revokeAllForUser(userId);
  await audit.log({ userId, action: 'PASSWORD_CHANGED', entity: 'users', entityId: userId, ipAddress: req?.ip });

  // Émet une paire fraîche pour que la session courante continue proprement.
  const freshUser = await userRepo.findById(userId);
  const tokens = await issueTokenPair(freshUser, req);
  return { ...tokens, user: publicUser(freshUser) };
}

async function forgotPassword(identifier, req) {
  const user = await userRepo.findWithSecretsByIdentifier(identifier);
  // Réponse toujours identique, que le compte existe ou non.
  if (user && user.is_active && user.email) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    await resetRepo.storeResetToken({
      userId: user.id,
      tokenHash: sha256(resetToken),
      expiresAt: new Date(Date.now() + env.resetPassword.expiresMinutes * 60_000),
    });
    const separator = env.resetPassword.url.includes('?') ? '&' : '?';
    const resetUrl = `${env.resetPassword.url}${separator}token=${resetToken}`;
    const html = resetPasswordTemplate({
      prenom: user.prenom,
      nom: user.nom,
      resetUrl,
      expiresMinutes: env.resetPassword.expiresMinutes,
    });
    try {
      await sendMail({ to: user.email, subject: 'School Vie — réinitialisation de votre mot de passe', html });
    } catch (err) {
      // Ne pas faire échouer la requête : réponse générique identique, erreur journalisée.
      logger.error('Échec de l’envoi du mail de réinitialisation', { message: err.message, userId: user.id });
    }
    await audit.log({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', ipAddress: req?.ip });
  }
  return { message: 'Si un compte correspond, un e-mail de réinitialisation vient d’être envoyé.' };
}

async function resetPassword(token, newPassword, req) {
  const tokenHash = sha256(token);
  const found = await resetRepo.findValidByHash(tokenHash);
  if (!found) {
    throw ApiError.badRequest('Lien de réinitialisation invalide ou expiré.', 'RESET_TOKEN_INVALID');
  }
  const newHash = await bcrypt.hash(newPassword, 12);
  await userRepo.updatePassword(found.user_id, newHash);
  await resetRepo.markUsed(found.id);
  await refreshRepo.revokeAllForUser(found.user_id);
  await audit.log({ userId: found.user_id, action: 'PASSWORD_RESET_DONE', entity: 'users', entityId: found.user_id, ipAddress: req?.ip });
  return { message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
}

async function sendWelcomeCredentials({ user, password }) {
  const loginUrl = env.clientUrl;
  const html = welcomeCredentialsTemplate({
    prenom: user.prenom,
    nom: user.nom,
    identifier: user.email || user.telephone,
    password,
    loginUrl,
  });
  if (user.email) {
    return sendMail({ to: user.email, subject: 'School Vie — vos identifiants de connexion', html });
  }
  logger.info(`Compte sans e-mail (${user.telephone}) : identifiants non envoyés par mail.`);
  return { delivered: false, dryRun: env.smtp.dryRun, skipped: true };
}

module.exports = {
  login,
  refresh,
  logout,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
  sendWelcomeCredentials,
};
