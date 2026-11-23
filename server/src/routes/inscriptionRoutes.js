// Inscriptions déléguées au Comptable (en remplacement de la Secrétaire absente).
// Monté sous /api/comptable/inscriptions. Toutes les routes exigent que le
// Directeur ait activé la délégation ; les services métiers journalisent
// ensuite la création de l'élève, le paiement et la preuve associée.
const express = require('express');
const secretaire = require('../controllers/secretaireController');
const justificatif = require('../controllers/justificatifController');
const { validate } = require('../middlewares/validate');
const { exigerDelegation } = require('../middlewares/exigerDelegation');
const { uploadPhoto, uploadJustificatif, multerErrorHandler } = require('../middlewares/upload');
const { inscriptionSchema, paiementInscriptionSchema } = require('../validators/inscriptionValidators');

const router = express.Router();
router.use(exigerDelegation('inscriptions_comptable_autorisee'));

/* Données nécessaires au wizard d'inscription */
router.get('/classes-pour-inscription', secretaire.classesPourInscription);
router.get('/frais-classe/:classId', secretaire.fraisClasse);

/* Création de l'élève + photo + règlement des frais d'inscription */
router.post('/eleves', validate(inscriptionSchema), secretaire.inscrire);
router.post('/eleves/:enrollmentId/photo', (req, res, next) => {
  uploadPhoto.single('photo')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, secretaire.uploadPhoto);
router.post('/eleves/:enrollmentId/paiement-inscription', validate(paiementInscriptionSchema), secretaire.payerInscription);

/* Preuve (scan/PDF) du reçu d'inscription rempli à la main */
router.post('/paiements/:paymentId/justificatif', (req, res, next) => {
  uploadJustificatif.single('justificatif')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, justificatif.poser);
router.delete('/paiements/:paymentId/justificatif', justificatif.retirer);

module.exports = router;
