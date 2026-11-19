// Routes Parent — consultation lecture seule de SES enfants (+ motifs d'absence).
const express = require('express');
const controleur = require('../controllers/parentController');
const { validate } = require('../middlewares/validate');
const { motifSchema } = require('../validators/presenceValidators');

const router = express.Router();

router.get('/dashboard', controleur.dashboard);
router.get('/mes-enfants', controleur.mesEnfants);
router.get('/notes/:enrollmentId', controleur.notesEnfant);
router.get('/edt/:enrollmentId', controleur.edtEnfant);
router.get('/finance/:enrollmentId', controleur.financeEnfant);
router.get('/absences/:enrollmentId', controleur.absencesEnfant);
router.post('/absences/:recordId/motif', validate(motifSchema), controleur.justifierMotif);
router.delete('/absences/:recordId/motif', controleur.retirerMotif);

module.exports = router;
