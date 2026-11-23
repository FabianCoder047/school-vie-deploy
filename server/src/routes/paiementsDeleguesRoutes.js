// Paiements de scolarité délégués à la Secrétaire (en remplacement du
// Comptable absent). Monté sous /api/secretaire/comptabilite.
// La recherche de comptes, l'encaissement, l'annulation et la preuve du reçu
// suivent exactement les mêmes services (et donc le même journal) que la
// route comptable d'origine.
const express = require('express');
const comptable = require('../controllers/comptableController');
const justificatif = require('../controllers/justificatifController');
const { validate } = require('../middlewares/validate');
const { exigerDelegation } = require('../middlewares/exigerDelegation');
const { uploadJustificatif, multerErrorHandler } = require('../middlewares/upload');
const { paiementScolariteSchema, annulationPaiementSchema } = require('../validators/inscriptionValidators');

const router = express.Router();
router.use(exigerDelegation('paiements_secretaire_autorisee'));

router.get('/comptes', comptable.listerComptes);
router.get('/comptes/:enrollmentId/situation', comptable.situation);

router.post('/paiements', validate(paiementScolariteSchema), comptable.payerScolarite);
router.post('/paiements/:paymentId/annuler', validate(annulationPaiementSchema), comptable.annulerPaiement);

router.post('/paiements/:paymentId/justificatif', (req, res, next) => {
  uploadJustificatif.single('justificatif')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, justificatif.poser);
router.delete('/paiements/:paymentId/justificatif', justificatif.retirer);

module.exports = router;
