// Routes Secrétaire — inscriptions, fiches élèves, paiement d'inscription.
const express = require('express');
const controleur = require('../controllers/secretaireController');
const { validate } = require('../middlewares/validate');
const { uploadPhoto, uploadJustificatif, multerErrorHandler } = require('../middlewares/upload');
const { inscriptionSchema, paiementInscriptionSchema, modifierEleveSchema } = require('../validators/inscriptionValidators');

const router = express.Router();

/* Inscription d'un élève */
router.post('/eleves', validate(inscriptionSchema), controleur.inscrire);
router.get('/classes-pour-inscription', controleur.classesPourInscription);
router.get('/frais-classe/:classId', controleur.fraisClasse);

/* Liste et fiches élèves */
router.get('/eleves', controleur.listerEleves);
router.get('/eleves/:enrollmentId', controleur.ficheEleve);
router.put('/eleves/:enrollmentId', validate(modifierEleveSchema), controleur.modifierEleve);
router.post('/eleves/:enrollmentId/photo', (req, res, next) => {
  uploadPhoto.single('photo')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, controleur.uploadPhoto);
router.delete('/eleves/:enrollmentId/photo', controleur.supprimerPhoto);

/* Situation financière + paiement d'inscription */
router.get('/eleves/:enrollmentId/situation', controleur.situation);
router.post('/eleves/:enrollmentId/paiement-inscription', validate(paiementInscriptionSchema), controleur.payerInscription);

/* Preuve (scan/PDF) du reçu d'inscription rempli à la main — « en cas de quoi » */
const justificatif = require('../controllers/justificatifController');
router.post('/paiements/:paymentId/justificatif', (req, res, next) => {
  uploadJustificatif.single('justificatif')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, justificatif.poser);
router.delete('/paiements/:paymentId/justificatif', justificatif.retirer);

/* Tableau de bord */
router.get('/dashboard', controleur.dashboard);

/* Routes partagées avec le Directeur : emploi du temps, documents (cartes/bulletins
   — avec feu vert obligatoire côté API), communiqués (publication) */
const edtRoutes = require('./edtRoutes');
const { verifierFeuVert } = require('../middlewares/impression');
const documents = require('../controllers/documentEtCommuniqueController');
const { communiqueSchema } = require('../validators/communiqueValidators');

router.use('/', edtRoutes);
router.get('/cartes/alias/:classAliasId', verifierFeuVert('cartes'), documents.cartesAlias);
router.get('/cartes/cycle/:cycleId', verifierFeuVert('cartes'), documents.cartesCycle);
router.get('/bulletins/alias/:classAliasId', verifierFeuVert('bulletins'), documents.bulletinsAlias);
router.get('/bulletins/cycle/:cycleId', verifierFeuVert('bulletins'), documents.bulletinsCycle);
router.get('/communiques', documents.listerCommuniques);
router.post('/communiques', validate(communiqueSchema), documents.publierCommunique);

/* Statistiques de présences (même agrégats que le directeur) */
const presenceStats = require('../controllers/presenceStatsController');
router.get('/statistiques-presences', presenceStats.statistiques);

module.exports = router;
