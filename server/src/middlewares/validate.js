// Validation Zod du corps de requête. En cas d'échec : 400 avec la
// première erreur en français (liste complète dans errors[]).
const { ApiError } = require('../utils/ApiError');

function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        champ: issue.path.join('.'),
        message: issue.message,
      }));
      const err = ApiError.badRequest(errors[0].message, 'VALIDATION_ERROR');
      err.errors = errors;
      return next(err);
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
