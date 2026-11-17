// Routes Parent — consultation lecture seule de SES enfants.
const express = require('express');
const controleur = require('../controllers/parentController');

const router = express.Router();

router.get('/dashboard', controleur.dashboard);
router.get('/mes-enfants', controleur.mesEnfants);
router.get('/notes/:enrollmentId', controleur.notesEnfant);
router.get('/edt/:enrollmentId', controleur.edtEnfant);
router.get('/finance/:enrollmentId', controleur.financeEnfant);

module.exports = router;
