// Reçus scannés (secrétaire ET comptable) — le PDF de reçu n'est plus généré
// par l'application ; le reçu papier est rempli à la main et scanné ici.
const service = require('../services/justificatifRecuService');

async function poser(req, res, next) {
  try {
    res.json(await service.poser(Number(req.params.paymentId), req.file || null, req.user.id, req.ip));
  } catch (e) { next(e); }
}

async function retirer(req, res, next) {
  try {
    res.json(await service.retirer(Number(req.params.paymentId), req.user.id, req.ip));
  } catch (e) { next(e); }
}

module.exports = { poser, retirer };
