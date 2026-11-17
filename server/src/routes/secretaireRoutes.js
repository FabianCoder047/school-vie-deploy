// Routes Secrétaire — inscriptions, fiches élèves, paiement d'inscription.
const express = require('express');
const controleur = require('../controllers/secretaireController');
const { validate } = require('../middlewares/validate');
const { uploadPhoto, multerErrorHandler } = require('../middlewares/upload');
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

/* Reçu d'inscription (PDF à la volée) */
router.get('/paiements/:paymentId/recu', controleur.recuInscription);

/* Tableau de bord */
router.get('/dashboard', controleur.dashboard);

module.exports = router;
