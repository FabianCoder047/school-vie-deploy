// Erreur applicative typée : portée par le gestionnaire d'erreurs central.
class ApiError extends Error {
  constructor(status, message, code = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.isOperational = true;
  }
  static badRequest(msg, code) { return new ApiError(400, msg, code); }
  static unauthorized(msg = 'Non authentifié.', code) { return new ApiError(401, msg, code); }
  static forbidden(msg = 'Accès refusé.', code) { return new ApiError(403, msg, code); }
  static notFound(msg = 'Ressource introuvable.', code) { return new ApiError(404, msg, code); }
  static conflict(msg, code) { return new ApiError(409, msg, code); }
  static locked(msg, code) { return new ApiError(423, msg, code); }
}

module.exports = { ApiError };
