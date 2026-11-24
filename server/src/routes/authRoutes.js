// Routes d'authentification (publique : login / refresh / forgot / reset ;
// protégées : me / change-password / logout).
const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authenticate');
const { authLimiter, sensitiveAuthLimiter } = require('../middlewares/rateLimit');
const { validate } = require('../middlewares/validate');
const {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, validate(refreshSchema), authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.post('/forgot-password', sensitiveAuthLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', sensitiveAuthLimiter, validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
