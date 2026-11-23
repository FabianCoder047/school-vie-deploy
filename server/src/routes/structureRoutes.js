// Tâches de structure déléguées à la Secrétaire par le Directeur :
// matières, affectations matière↔classe, affectations professeur, années.
// Monté sous /api/secretaire (contrôle de rôle fait dans app.js). Chaque
// écriture est conditionnée à l'interrupteur correspondant ET journalisée
// par le service métier (cf. auditRepository).
const express = require('express');
const referentiel = require('../controllers/referentielController');
const affectations = require('../controllers/affectationController');
const settings = require('../controllers/settingsAndDashboardController');
const { validate } = require('../middlewares/validate');
const { exigerDelegation } = require('../middlewares/exigerDelegation');
const {
  matiereSchema, anneeAcademiqueSchema, affectationMatiereSchema, affectationProfesseurSchema,
} = require('../validators/configurationValidators');

const router = express.Router();

const matieres = exigerDelegation('matieres_secretaire_autorisee');
const affectationsAutorisees = exigerDelegation('affectations_secretaire_autorisee');
const annees = exigerDelegation('annees_secretaire_autorisee');

/* Liste des professeurs (nécessaire aux affectations classe-matière-prof) */
router.get('/professeurs', settings.listerProfesseurs);

/* Matières */
router.get('/subjects', referentiel.listerMatieres);
router.post('/subjects', matieres, validate(matiereSchema), referentiel.creerMatiere);
router.put('/subjects/:id', matieres, validate(matiereSchema), referentiel.modifierMatiere);
router.delete('/subjects/:id', matieres, referentiel.supprimerMatiere);

/* Années académiques */
router.get('/annees-academiques', referentiel.listerAnnees);
router.post('/annees-academiques', annees, validate(anneeAcademiqueSchema), referentiel.creerAnnee);
router.put('/annees-academiques/:id', annees, validate(anneeAcademiqueSchema), referentiel.modifierAnnee);
router.delete('/annees-academiques/:id', annees, referentiel.supprimerAnnee);
router.post('/annees-academiques/:id/courante', annees, referentiel.definirAnneeCourante);

/* Matière → classes (+ coefficients) */
router.get('/affectations', affectations.listerAffectations);
router.post('/affectations', affectationsAutorisees, validate(affectationMatiereSchema), affectations.affecterMatiere);
router.delete('/affectations/:id', affectationsAutorisees, affectations.retirerAffectationMatiere);

/* Professeur → (matière × alias × année) */
router.get('/affectations-professeur', affectations.listerAffectationsProfesseur);
router.post('/affectations-professeur', affectationsAutorisees, validate(affectationProfesseurSchema), affectations.affecterProfesseur);
router.delete('/affectations-professeur/:id', affectationsAutorisees, affectations.retirerAffectationProfesseur);

module.exports = router;
