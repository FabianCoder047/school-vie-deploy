// Routes Comptable — paiements, comptes, relances, rapports.
const express = require('express');
const controleur = require('../controllers/comptableController');
const { validate } = require('../middlewares/validate');
const { paiementScolariteSchema, annulationPaiementSchema, relanceSchema } = require('../validators/inscriptionValidators');

const router = express.Router();

/* Paiements de scolarité */
router.post('/paiements', validate(paiementScolariteSchema), controleur.payerScolarite);
router.post('/paiements/:paymentId/annuler', validate(annulationPaiementSchema), controleur.annulerPaiement);
/* Preuve (scan/PDF) du reçu de paiement rempli à la main — « en cas de quoi » */
const justificatif = require('../controllers/justificatifController');
const { uploadJustificatif, multerErrorHandler } = require('../middlewares/upload');
router.post('/paiements/:paymentId/justificatif', (req, res, next) => {
  uploadJustificatif.single('justificatif')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, justificatif.poser);
router.delete('/paiements/:paymentId/justificatif', justificatif.retirer);

/* Comptes de scolarité */
router.get('/comptes', controleur.listerComptes);
router.get('/comptes-en-retard', controleur.comptesEnRetard);
router.get('/comptes/:enrollmentId/situation', controleur.situation);

/* Fiches de retard (PDF) */
router.get('/fiches-retard/pdf', controleur.fichesRetardPdf);

/* Relances parents */
router.post('/relances', validate(relanceSchema), controleur.relancer);
router.get('/relances/historique', controleur.historiqueRelances);

/* Liste de renvoi (classe, échéances arrêtées à une date) — aperçu JSON + PDF */
router.get('/liste-renvoi', controleur.listeRenvoiJson);
router.get('/liste-renvoi/pdf', controleur.listeRenvoiPdf);

/* Rapports comptables */
router.get('/rapports', controleur.rapportJson);
router.get('/rapports/pdf', controleur.rapportPdf);

/* Tableau de bord */
router.get('/dashboard', controleur.dashboard);

/* Inscriptions déléguées par le Directeur (si la Secrétaire est absente) */
router.use('/inscriptions', require('./inscriptionRoutes'));

module.exports = router;
