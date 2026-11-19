// Emploi du temps — contrôleurs partagés Directeur / Secrétaire
// (mêmes règles métier, mêmes contrôles côté API).
const express = require('express');
const controleur = require('../controllers/pedagogieController');
const { validate } = require('../middlewares/validate');
const { creneauSchema } = require('../validators/pedagogieValidators');

const router = express.Router();

router.get('/edt', controleur.listerCreneaux);
router.get('/edt-affectations', controleur.affectationsPourAlias);
router.post('/edt', validate(creneauSchema), controleur.creerCreneau);
router.put('/edt/:id', validate(creneauSchema), controleur.modifierCreneau);
router.delete('/edt/:id', controleur.supprimerCreneau);

module.exports = router;
