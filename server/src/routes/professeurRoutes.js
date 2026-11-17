// Routes Professeur — classes, saisie des notes, appel, EDT perso, KPI.
const express = require('express');
const controleur = require('../controllers/professeurController');
const { validate } = require('../middlewares/validate');
const { feuilleNotesSchema, appelSchema } = require('../validators/pedagogieValidators');

const router = express.Router();

/* Accueil : mes classes + élèves de l'alias (appel) */
router.get('/mes-classes', controleur.mesClasses);
router.get('/eleves-alias', controleur.elevesAlias);

/* Saisie des notes (fenêtre stricte) */
router.get('/feuille', controleur.feuille);
router.put('/feuille', validate(feuilleNotesSchema), controleur.enregistrerFeuille);

/* Appel */
router.get('/creneaux-du-jour', controleur.creneauxDuJour);
router.get('/appel', controleur.seanceDuJour);
router.post('/appel', validate(appelSchema), controleur.enregistrerAppel);
router.get('/appel/seances-recentes', controleur.seancesRecentes);

/* Mon emploi du temps (lecture seule) */
router.get('/mon-edt', controleur.monEdt);

/* Tableau de bord */
router.get('/dashboard', controleur.dashboard);

module.exports = router;
