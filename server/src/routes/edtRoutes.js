// Emploi du temps — contrôleurs partagés Directeur / Secrétaire
// (mêmes règles métier, mêmes contrôles côté API).
const express = require('express');
const controleur = require('../controllers/pedagogieController');
const { validate } = require('../middlewares/validate');
const { creneauSchema } = require('../validators/pedagogieValidators');
const { verifierFeuVert } = require('../middlewares/impression');

const router = express.Router();

router.get('/edt', controleur.listerCreneaux);
router.get('/edt-affectations', controleur.affectationsPourAlias);
router.get('/edt-config', controleur.configurationEdt);

/* Impression des emplois du temps (feu vert du directeur pour la secrétaire). */
router.get('/edt/pdf', verifierFeuVert('edts'), controleur.edtPdfAlias);
router.get('/edt/pdf/classe', verifierFeuVert('edts'), controleur.edtPdfClasse);
router.get('/edt/pdf/cycle', verifierFeuVert('edts'), controleur.edtPdfCycle);
router.post('/edt', validate(creneauSchema), controleur.creerCreneau);
router.put('/edt/:id', validate(creneauSchema), controleur.modifierCreneau);
router.delete('/edt/:id', controleur.supprimerCreneau);

module.exports = router;
