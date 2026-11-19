// Routes Administrateur — référentiels, années, paramètres, directeurs, KPI.
const express = require('express');
const controleur = require('../controllers/referentielController');
const comptes = require('../controllers/accountsController');
const settings = require('../controllers/settingsAndDashboardController');
const sauvegarde = require('../controllers/sauvegardeController');
const journal = require('../controllers/journalController');
const { validate } = require('../middlewares/validate');
const { uploadBackupMemory, multerErrorHandler } = require('../middlewares/upload');
const {
  cycleSchema, classeSchema, matiereSchema, anneeAcademiqueSchema,
  creationCompteSchema, statutCompteSchema, maintenanceSchema,
} = require('../validators/configurationValidators');
const maintenance = require('../controllers/maintenanceController');
const { generationSauvegardeSchema } = require('../validators/sauvegardeValidators');

const router = express.Router();

/* Cycles */
router.post('/cycles', validate(cycleSchema), controleur.creerCycle);
router.put('/cycles/:id', validate(cycleSchema), controleur.modifierCycle);
router.delete('/cycles/:id', controleur.supprimerCycle);

/* Classes */
router.post('/classes', validate(classeSchema), controleur.creerClasse);
router.put('/classes/:id', validate(classeSchema), controleur.modifierClasse);
router.delete('/classes/:id', controleur.supprimerClasse);

/* Matières */
router.post('/subjects', validate(matiereSchema), controleur.creerMatiere);
router.put('/subjects/:id', validate(matiereSchema), controleur.modifierMatiere);
router.delete('/subjects/:id', controleur.supprimerMatiere);

/* Années académiques */
router.post('/annees-academiques', validate(anneeAcademiqueSchema), controleur.creerAnnee);
router.put('/annees-academiques/:id', validate(anneeAcademiqueSchema), controleur.modifierAnnee);
router.delete('/annees-academiques/:id', controleur.supprimerAnnee);
router.post('/annees-academiques/:id/courante', controleur.definirAnneeCourante);

/* Paramètres de l'école : déplacés vers l'espace Directeur. */

/* Comptes Directeur */
router.get('/directeurs', comptes.lister);
router.post('/directeurs', validate(creationCompteSchema), comptes.creer);
router.patch('/directeurs/:id/statut', validate(statutCompteSchema), comptes.setStatut);
router.post('/directeurs/:id/renvoyer-identifiants', comptes.renvoyerIdentifiants);

/* Maintenance — fenêtre définie par l'administrateur (le site est inactif pour les autres) */
router.get('/maintenance', maintenance.lireMaintenance);
router.put('/maintenance', validate(maintenanceSchema), maintenance.definirMaintenance);
router.post('/maintenance/terminer', maintenance.terminerMaintenance);

/* Sauvegardes par année académique */
router.get('/sauvegardes', sauvegarde.lister);
router.post('/sauvegardes', validate(generationSauvegardeSchema), sauvegarde.generer);
router.post('/sauvegardes/restaurer', (req, res, next) => {
  uploadBackupMemory.single('sauvegarde')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, sauvegarde.restaurer);

/* Journal d'activités — tout le monde (lecture paginée, filtres) */
router.get('/journal', journal.lister);
router.get('/journal/filtres', journal.filtres);

/* Tableau de bord */
router.get('/dashboard', settings.dashboardAdmin);

module.exports = router;
