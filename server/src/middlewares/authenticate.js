// Authentification : vérifie le Bearer access token et charge
// l'utilisateur (sans hash) dans req.user.
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError } = require('../utils/ApiError');
const userRepo = require('../repositories/userRepository');

async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Authentification requise.', 'AUTH_REQUIRED');
    }
    let payload;
    try {
      payload = jwt.verify(token, env.jwt.accessSecret);
    } catch (_err) {
      throw ApiError.unauthorized('Session expirée ou invalide.', 'TOKEN_INVALID');
    }
    const user = await userRepo.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('Compte introuvable.', 'USER_NOT_FOUND');
    req.user = {
      id: user.id,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      mustChangePassword: Boolean(user.must_change_password),
      isActive: Boolean(user.is_active),
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
