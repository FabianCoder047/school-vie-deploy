// Contrôleur HTTP de l'authentification : ne fait que traduire
// requêtes/réponses ; la logique métier vit dans services/authService.
const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const { identifier, password } = req.body;
    const result = await authService.login(identifier, password, req);
    res.json(result);
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = req.body?.refreshToken || null;
    const result = await authService.refresh(refreshToken, req);
    res.json(result);
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const refreshToken = req.body?.refreshToken || null;
    const result = await authService.logout(refreshToken);
    res.json(result);
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    res.json({ user: await authService.me(req.user.id) });
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword, req);
    res.json(result);
  } catch (err) { next(err); }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body.identifier, req);
    res.json(result);
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword, req);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { login, refresh, logout, me, changePassword, forgotPassword, resetPassword };
