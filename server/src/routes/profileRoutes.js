// Routes profil — tout utilisateur authentifié avec mot de passe à jour.
const express = require('express');
const profil = require('../controllers/profileController');
const { authenticate } = require('../middlewares/authenticate');
const { requirePasswordChanged } = require('../middlewares/authorizeRoles');
const { validate } = require('../middlewares/validate');
const { profilSchema } = require('../validators/profileValidators');

const router = express.Router();
router.get('/', authenticate, requirePasswordChanged, profil.lire);
router.put('/', authenticate, requirePasswordChanged, validate(profilSchema), profil.modifier);

module.exports = router;
