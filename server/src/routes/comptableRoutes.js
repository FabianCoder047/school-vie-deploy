// Routes Comptable — paiements, comptes, relances, rapports.
const express = require('express');
const controleur = require('../controllers/comptableController');
const { validate } = require('../middlewares/validate');
const { paiementScolariteSchema, annulationPaiementSchema, relanceSchema } = require('../validators/inscriptionValidators');

const router = express.Router();

/* Paiements de scolarité */
router.post('/paiements', validate(paiementScolariteSchema), controleur.payerScolarite);
router.post('/paiements/:paymentId/annuler', validate(annulationPaiementSchema), controleur.annulerPaiement);
router.get('/paiements/:paymentId/recu', controleur.recuPaiement);

/* Comptes de scolarité */
router.get('/comptes', controleur.listerComptes);
router.get('/comptes-en-retard', controleur.comptesEnRetard);
router.get('/comptes/:enrollmentId/situation', controleur.situation);

/* Fiches de retard (PDF) */
router.get('/fiches-retard/pdf', controleur.fichesRetardPdf);

/* Relances parents */
router.post('/relances', validate(relanceSchema), controleur.relancer);
router.get('/relances/historique', controleur.historiqueRelances);

/* Rapports comptables */
router.get('/rapports', controleur.rapportJson);
router.get('/rapports/pdf', controleur.rapportPdf);

/* Tableau de bord */
router.get('/dashboard', controleur.dashboard);

module.exports = router;
