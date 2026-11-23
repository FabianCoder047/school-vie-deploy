// Contrôle des délégations de tâches décidées par le Directeur.
// Usage : router.post('/eleves', exigerDelegation('inscriptions_comptable_autorisee'), …)
// L'API reste la source de vérité : le front peut masquer un menu, seul ce
// middleware garantit qu'une tâche déléguée est bien active au moment de l'action.
const { ApiError } = require('../utils/ApiError');
const settingsRepo = require('../repositories/settingsRepository');

function exigerDelegation(cle) {
  return async (req, _res, next) => {
    try {
      const delegations = await settingsRepo.lireDelegations();
      if (!delegations || !delegations[cle]) {
        return next(
          ApiError.forbidden(
            'Cette tâche ne vous est pas déléguée. Demandez au Directeur de l’activer.',
            'DELEGATION_REQUIRED'
          )
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { exigerDelegation };
