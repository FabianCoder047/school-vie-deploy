// Routes Directeur — périodes d'évaluation et emploi du temps.
const express = require('express');
const controleur = require('../controllers/pedagogieController');
const { validate } = require('../middlewares/validate');
const { periodeSchema } = require('../validators/pedagogieValidators');

const router = express.Router();
const edtRoutes = require('./edtRoutes');

/* Périodes d'évaluation + fenêtres de saisie */
router.get('/periodes', controleur.listerPeriodes);
router.post('/periodes', validate(periodeSchema), controleur.creerPeriode);
router.put('/periodes/:id', validate(periodeSchema), controleur.modifierPeriode);
router.delete('/periodes/:id', controleur.supprimerPeriode);

/* Emploi du temps (routes partagées avec la Secrétaire) */
router.use('/', edtRoutes);

module.exports = router;
