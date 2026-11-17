// Gestion des comptes (création, activation, renvoi des identifiants).
// Périmètre strict :
//  - ADMIN      → uniquement des comptes DIRECTEUR
//  - DIRECTEUR  → uniquement SECRETAIRE / COMPTABLE / PROFESSEUR
// Tout compte créé reçoit un mot de passe par défaut généré, envoyé par
// mail, avec obligation de changement à la 1ère connexion.
const bcrypt = require('bcrypt');
const { ApiError } = require('../utils/ApiError');
const { generateDefaultPassword } = require('../utils/password');
const userMgmtRepo = require('../repositories/userManagementRepository');
const refreshRepo = require('../repositories/refreshTokenRepository');
const { log: audit } = require('../repositories/auditRepository');
const { sendWelcomeCredentials } = require('./authService');
const logger = require('../utils/logger');

const PERIMETRES = {
  ADMIN: ['DIRECTEUR'],
  DIRECTEUR: ['SECRETAIRE', 'COMPTABLE', 'PROFESSEUR'],
};

function verifierPerimetre(callerRole, roleCible) {
  const autorises = PERIMETRES[callerRole] || [];
  if (!autorises.includes(roleCible)) {
    throw ApiError.forbidden(
      callerRole === 'ADMIN'
        ? 'Seul l’Administrateur crée des comptes Directeur.'
        : 'Vous ne pouvez créer que des comptes Secrétaire, Comptable ou Professeur.',
      'ROLE_CIBLE_INTERDIT'
    );
  }
}

function perimetreOf(callerRole) {
  return PERIMETRES[callerRole] || [];
}

/** Liste paginée + filtrable, limitée au périmètre du rôle appelant. */
async function listerComptes(callerRole, query) {
  const roles = perimetreOf(callerRole);
  // Un DIRECTEUR ne peut pas élargir le filtre à ses collègues admins/directeurs.
  if (query.role && !roles.includes(query.role)) {
    return { rows: [], total: 0, page: 1, parPage: Number(query.parPage) || 10 };
  }
  return userMgmtRepo.list(query, roles);
}

async function creerCompte(callerRole, callerId, data, ip) {
  verifierPerimetre(callerRole, data.role);

  const email = data.email?.trim() || null;
  const telephone = data.telephone?.trim() || null;
  if (!email && !telephone) {
    throw ApiError.badRequest('Un e-mail ou un téléphone est requis.', 'IDENTIFIANT_REQUIS');
  }
  if (await userMgmtRepo.existeEmailOuTelephone(email, telephone)) {
    throw ApiError.conflict('Un compte existe déjà avec cet e-mail ou ce téléphone.', 'COMPTE_EXISTE');
  }

  const motDePasse = generateDefaultPassword();
  const passwordHash = await bcrypt.hash(motDePasse, 12);
  const user = await userMgmtRepo.create({
    role: data.role,
    nom: data.nom.trim(),
    prenom: data.prenom.trim(),
    email: email ? email.toLowerCase() : null,
    telephone,
    passwordHash,
    createdBy: callerId,
  });

  await audit({ userId: callerId, action: 'CREATE', entity: 'users', entityId: user.id, newValues: { role: user.role, email: user.email, nom: user.nom, prenom: user.prenom }, ipAddress: ip });

  // Envoi du mail ; en cas d'échec SMTP, le mot de passe temporaire est
  // renvoyé UNE seule fois dans la réponse pour être transmis au titulaire.
  let mail = { delivered: false, skipped: false };
  let motDePasseTemporaireAffiche = null;
  try {
    mail = await sendWelcomeCredentials({ user, password: motDePasse });
    if (!mail.delivered) motDePasseTemporaireAffiche = motDePasse; // non délivié (dry-run, SMTP KO, pas d'e-mail) → affiché une fois
  } catch (err) {
    logger.error('Échec de l’envoi du mail d’identifiants', { message: err.message, userId: user.id });
    mail = { delivered: false, skipped: false, erreur: err.message };
    motDePasseTemporaireAffiche = motDePasse;
  }

  return { user, mailEnvoye: Boolean(mail.delivered), motDePasseTemporaire: motDePasseTemporaireAffiche };
}

/** Active / désactive un compte du périmètre. */
async function setStatut(callerRole, callerId, id, isActive, ip) {
  const cible = await userMgmtRepo.findById(id);
  if (!cible) throw ApiError.notFound('Compte introuvable.');
  verifierPerimetre(callerRole, cible.role);
  const user = await userMgmtRepo.setActive(id, isActive);
  if (!isActive) await refreshRepo.revokeAllForUser(id); // coupe les sessions actives
  await audit({
    userId: callerId,
    action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    entity: 'users',
    entityId: id,
    ipAddress: ip,
  });
  return user;
}

/** Génère un nouveau mot de passe temporaire et renvoie le mail. */
async function renvoyerIdentifiants(callerRole, callerId, id, ip) {
  const cible = await userMgmtRepo.findById(id);
  if (!cible) throw ApiError.notFound('Compte introuvable.');
  verifierPerimetre(callerRole, cible.role);

  const motDePasse = generateDefaultPassword();
  await userMgmtRepo.setTemporaryPassword(id, await bcrypt.hash(motDePasse, 12));
  await refreshRepo.revokeAllForUser(id);
  await audit({ userId: callerId, action: 'RESEND_CREDENTIALS', entity: 'users', entityId: id, ipAddress: ip });

  let mailEnvoye = false;
  let motDePasseTemporaireAffiche = null;
  try {
    const mail = await sendWelcomeCredentials({ user: cible, password: motDePasse });
    mailEnvoye = Boolean(mail.delivered);
    if (!mail.delivered) motDePasseTemporaireAffiche = motDePasse;
  } catch (err) {
    logger.error('Échec de l’envoi des identifiants', { message: err.message, userId: id });
    motDePasseTemporaireAffiche = motDePasse;
  }
  return { mailEnvoye, motDePasseTemporaire: motDePasseTemporaireAffiche };
}

async function listerProfesseurs() {
  return userMgmtRepo.listProfesseurs();
}

module.exports = { listerComptes, creerCompte, setStatut, renvoyerIdentifiants, listerProfesseurs, PERIMETRES };
