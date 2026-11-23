// Profil de l'utilisateur connecté — consulter et modifier ses infos.
// Le mot de passe se change via /api/auth/change-password (déjà en place).
const { ApiError } = require('../utils/ApiError');
const pool = require('../config/db');
const { log: audit } = require('../repositories/auditRepository');
const settingsRepo = require('../repositories/settingsRepository');

const PUBLIC = 'id, role, nom, prenom, email, telephone, must_change_password, is_active, last_login_at, created_at';

async function lireProfil(userId) {
  const [[user]] = await pool.query(`SELECT ${PUBLIC} FROM users WHERE id = ?`, [userId]);
  if (!user) throw ApiError.notFound('Utilisateur introuvable.');
  const ecole = await settingsRepo.get();
  return { user, ecole: ecole ? { nom: ecole.nom, logo_path: ecole.logo_path, adresse: ecole.adresse } : null };
}

async function modifierProfil(userId, data, ip) {
  const [[actuel]] = await pool.query('SELECT id, nom, prenom, email, telephone FROM users WHERE id = ?', [userId]);
  if (!actuel) throw ApiError.notFound('Utilisateur introuvable.');

  const email = data.email?.trim().toLowerCase() || null;
  const telephone = data.telephone?.trim() || null;
  const nom = data.nom.trim();
  const prenom = data.prenom.trim();

  if (!nom || !prenom) {
    throw ApiError.badRequest('Le nom et le prénom sont requis.', 'NOM_PRENOM_REQUIS');
  }
  if (!email && !telephone) {
    throw ApiError.badRequest('Un e-mail ou un téléphone est requis (identifiant de connexion).', 'IDENTIFIANT_REQUIS');
  }

  // Unicité e-mail / téléphone hors du compte courant
  if (email) {
    const [[existEmail]] = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, userId]);
    if (existEmail) throw ApiError.conflict('Cette adresse e-mail est déjà utilisée par un autre compte.', 'EMAIL_DEJA_UTILISE');
  }
  if (telephone) {
    const [[existTel]] = await pool.query('SELECT id FROM users WHERE telephone = ? AND id <> ? LIMIT 1', [telephone, userId]);
    if (existTel) throw ApiError.conflict('Ce numéro de téléphone est déjà utilisé par un autre compte.', 'TELEPHONE_DEJA_UTILISE');
  }

  await pool.query(
    'UPDATE users SET nom = ?, prenom = ?, email = ?, telephone = ? WHERE id = ?',
    [nom, prenom, email, telephone, userId]
  );
  const ecole = await settingsRepo.get();
  const [[user]] = await pool.query(`SELECT ${PUBLIC} FROM users WHERE id = ?`, [userId]);
  await audit({ userId, action: 'PROFILE_UPDATE', entity: 'users', entityId: userId, oldValues: { nom: actuel.nom, prenom: actuel.prenom, email: actuel.email, telephone: actuel.telephone }, newValues: data, ipAddress: ip });
  return { user, ecole: ecole ? { nom: ecole.nom, logo_path: ecole.logo_path, adresse: ecole.adresse } : null };
}

module.exports = { lireProfil, modifierProfil };
