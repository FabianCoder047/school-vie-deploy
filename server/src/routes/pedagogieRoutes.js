// Routes Directeur — périodes d'évaluation et emploi du temps.
const express = require('express');
const controleur = require('../controllers/pedagogieController');
const { validate } = require('../middlewares/validate');
const { periodeSchema, creneauSchema } = require('../validators/pedagogieValidators');

const router = express.Router();

/* Périodes d'évaluation + fenêtres de saisie */
router.get('/periodes', controleur.listerPeriodes);
router.post('/periodes', validate(periodeSchema), controleur.creerPeriode);
router.put('/periodes/:id', validate(periodeSchema), controleur.modifierPeriode);
router.delete('/periodes/:id', controleur.supprimerPeriode);

/* Emploi du temps */
router.get('/edt', controleur.listerCreneaux);
router.get('/edt-affectations', controleur.affectationsPourAlias);
router.post('/edt', validate(creneauSchema), controleur.creerCreneau);
router.put('/edt/:id', validate(creneauSchema), controleur.modifierCreneau);
router.delete('/edt/:id', controleur.supprimerCreneau);

module.exports = router;
