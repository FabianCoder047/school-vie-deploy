// Contrôle d'accès par rôle. Usage : authorizeRoles('ADMIN', 'DIRECTEUR')
const { ApiError } = require('../utils/ApiError');

function authorizeRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Vous n’avez pas accès à cette ressource.', 'ROLE_FORBIDDEN'));
    }
    next();
  };
}

// Bloque toutes les routes métier tant que le mot de passe temporaire
// n'a pas été changé (le code front redirige alors vers la page dédiée).
function requirePasswordChanged(req, _res, next) {
  if (req.user?.mustChangePassword) {
    return next(
      ApiError.forbidden(
        'Vous devez changer votre mot de passe avant de continuer.',
        'PASSWORD_CHANGE_REQUIRED'
      )
    );
  }
  if (req.user && !req.user.isActive) {
    return next(ApiError.forbidden('Ce compte est désactivé.', 'ACCOUNT_DISABLED'));
  }
  next();
}

module.exports = { authorizeRoles, requirePasswordChanged };
