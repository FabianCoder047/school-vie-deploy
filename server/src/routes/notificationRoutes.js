// Routes notifications (tout rôle authentifié + mot de passe à jour) + communiqués (Directeur).
const express = require('express');
const notificationController = require('../controllers/notificationController');
const documentEtCommunique = require('../controllers/documentEtCommuniqueController');
const { validate } = require('../middlewares/validate');
const { communiqueSchema } = require('../validators/communiqueValidators');

const notificationsRouter = express.Router();
notificationsRouter.get('/', notificationController.lister);
notificationsRouter.get('/non-lues/count', notificationController.compterNonLues);
notificationsRouter.post('/:id/lue', notificationController.marquerLue);
notificationsRouter.post('/tout-lire', notificationController.marquerToutesLues);

const directeurDocumentsRouter = express.Router();
directeurDocumentsRouter.get('/cartes/alias/:classAliasId', documentEtCommunique.cartesAlias);
directeurDocumentsRouter.get('/cartes/cycle/:cycleId', documentEtCommunique.cartesCycle);
directeurDocumentsRouter.get('/bulletins/alias/:classAliasId', documentEtCommunique.bulletinsAlias);
directeurDocumentsRouter.get('/bulletins/cycle/:cycleId', documentEtCommunique.bulletinsCycle);
directeurDocumentsRouter.get('/communiques', documentEtCommunique.listerCommuniques);
directeurDocumentsRouter.post('/communiques', validate(communiqueSchema), documentEtCommunique.publierCommunique);

module.exports = { notificationsRouter, directeurDocumentsRouter };
