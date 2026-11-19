// Routes Directeur — utilisateurs de l'école, alias, affectations, KPI.
const express = require('express');
const comptes = require('../controllers/accountsController');
const affectations = require('../controllers/affectationController');
const settings = require('../controllers/settingsAndDashboardController');
const frais = require('../controllers/fraisController');
const pedagogie = require('./pedagogieRoutes');
const { validate } = require('../middlewares/validate');
const {
  creationCompteSchema, statutCompteSchema, aliasSchema,
  affectationMatiereSchema, affectationProfesseurSchema, parametresSchema,
} = require('../validators/configurationValidators');
const { fraisUnitaireSchema, fraisGroupeSchema } = require('../validators/inscriptionValidators');

const router = express.Router();

/* Utilisateurs de l'école (SECRETAIRE / COMPTABLE / PROFESSEUR) */
router.get('/utilisateurs', comptes.lister);
router.post('/utilisateurs', validate(creationCompteSchema), comptes.creer);
router.patch('/utilisateurs/:id/statut', validate(statutCompteSchema), comptes.setStatut);
router.post('/utilisateurs/:id/renvoyer-identifiants', comptes.renvoyerIdentifiants);

/* Alias de classe */
router.post('/alias', validate(aliasSchema), affectations.creerAlias);
router.put('/alias/:id', validate(aliasSchema), affectations.modifierAlias);
router.delete('/alias/:id', affectations.supprimerAlias);

/* Matière → classes (+ coefficients) */
router.get('/affectations', affectations.listerAffectations);
router.post('/affectations', validate(affectationMatiereSchema), affectations.affecterMatiere);
router.delete('/affectations/:id', affectations.retirerAffectationMatiere);

/* Professeur → (matière × alias × année) */
router.get('/professeurs', settings.listerProfesseurs);
router.get('/affectations-professeur', affectations.listerAffectationsProfesseur);
router.post('/affectations-professeur', validate(affectationProfesseurSchema), affectations.affecterProfesseur);
router.delete('/affectations-professeur/:id', affectations.retirerAffectationProfesseur);

/* ===== Feu vert du directeur (impression cartes / bulletins par la secrétaire) ===== */
const impression = require('../controllers/impressionController');
const { impressionSchema } = require('../validators/configurationValidators');
router.put('/impressions/cartes', validate(impressionSchema), impression.basculerCartes);
router.put('/impressions/bulletins', validate(impressionSchema), impression.basculerBulletins);

/* Signature du directeur (dessinée dans l'app, souris ou doigt, ou uploadée si la main n'y arrive pas) */
const directeurSignature = require('../controllers/directeurSignatureController');
const { uploadSignature, uploadLogo, uploadCachet, multerErrorHandler } = require('../middlewares/upload');
router.post('/signature', directeurSignature.definirSignatureDessinee);
router.post('/signature/image', (req, res, next) => {
  uploadSignature.single('signature')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, directeurSignature.definirSignatureUploadee);
router.delete('/signature', directeurSignature.supprimerSignature);

/* Paramètres de l'école (réservés au Directeur) */
router.put('/parametres', validate(parametresSchema), settings.modifierParametres);
router.post('/parametres/logo', (req, res, next) => {
  uploadLogo.single('logo')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, settings.uploadLogo);
router.post('/parametres/cachet', (req, res, next) => {
  uploadCachet.single('cachet')(req, res, (err) => (err ? multerErrorHandler(err, req, res, next) : next()));
}, settings.uploadCachet);
router.delete('/parametres/cachet', settings.supprimerCachet);

/* Frais de scolarité + modalités (cases à cocher) */
router.get('/frais', frais.lister);
router.put('/frais/classe', validate(fraisUnitaireSchema), frais.enregistrerUnitaire);
router.put('/frais/groupe', validate(fraisGroupeSchema), frais.enregistrerGroupe);

/* Périodes d'évaluation + emploi du temps */
router.use('/', pedagogie);

/* Statistiques de présences + fiche absences d'un élève */
const presenceStats = require('../controllers/presenceStatsController');
router.get('/statistiques-presences', presenceStats.statistiques);
router.get('/eleve/:enrollmentId/absences', presenceStats.absencesEleveDirecteur);

/* Tableau de bord */
router.get('/dashboard', settings.dashboardDirecteur);

module.exports = router;
