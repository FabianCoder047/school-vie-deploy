// Contrôleur HTTP — notifications internes (cloche).
const notificationRepo = require('../repositories/notificationRepository');

async function lister(req, res, next) {
  try { res.json(await notificationRepo.listByUser(req.user.id, req.query)); } catch (e) { next(e); }
}
async function compterNonLues(req, res, next) {
  try { res.json({ nonLues: await notificationRepo.compterNonLues(req.user.id) }); } catch (e) { next(e); }
}
async function marquerLue(req, res, next) {
  try { res.json({ success: await notificationRepo.marquerLue(Number(req.params.id), req.user.id) }); } catch (e) { next(e); }
}
async function marquerToutesLues(req, res, next) {
  try { res.json({ marquees: await notificationRepo.marquerToutesLues(req.user.id) }); } catch (e) { next(e); }
}

module.exports = { lister, compterNonLues, marquerLue, marquerToutesLues };
