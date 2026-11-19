// Routes de lecture des référentiels — tout utilisateur authentifié
// (écrans de sélection en cascade du Directeur, futurs écrans Secrétaire/Comptable).
const express = require('express');
const controller = require('../controllers/referentielController');
const aff = require('../controllers/affectationController');
const settings = require('../controllers/settingsAndDashboardController');
const pedagogie = require('../controllers/pedagogieController');
const documents = require('../controllers/documentEtCommuniqueController');

const router = express.Router();

router.get('/cycles', controller.listerCycles);
router.get('/classes', controller.listerClasses);
router.get('/classes/toutes', controller.listerToutesLesClasses);
router.get('/subjects', controller.listerMatieres);
router.get('/subjects/toutes', controller.listerToutesLesMatieres);
router.get('/annees-academiques', controller.listerAnnees);
router.get('/annees-academiques/toutes', controller.listerToutesLesAnnees);
router.get('/annees-academiques/courante', controller.anneeCourante);
router.get('/alias', aff.listerAlias);
router.get('/alias/classe/:classId', aff.listerAliasDeClasse);
router.get('/parametres', settings.lireParametres);
// Lecture des périodes (fenêtres de saisie visibles par les professeurs)
router.get('/periodes', pedagogie.listerPeriodes);
// Horaires de l'emploi du temps (pause, 55 min, retour 14h30, fin primaire…)
router.get('/edt-config', pedagogie.configurationEdt);
// Communiqués pour le tableau de bord de l'utilisateur connecté :
// pilotage (ADMIN/DIRECTEUR/SECRETAIRE) → tout ; autres rôles → ceux qui les concernent.
router.get('/communiques', documents.listerCommuniquesPourMoi);

module.exports = router;
