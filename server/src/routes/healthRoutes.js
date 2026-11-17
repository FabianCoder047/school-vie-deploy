// Routes utilitaires : santé (public) + canari d'accès protégé.
const express = require('express');
const { authenticate } = require('../middlewares/authenticate');
const { authorizeRoles, requirePasswordChanged } = require('../middlewares/authorizeRoles');

const router = express.Router();

// Public : utilisé par le monitoring / le déploiement.
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Canari : prouve authenticate + requirePasswordChanged (403 tant que
// must_change_password = 1).
router.get('/protected/ping', authenticate, requirePasswordChanged, (req, res) => {
  res.json({ message: 'pong', role: req.user.role });
});

// Canari rôle : réservé à l'ADMIN (403 ROLE_FORBIDDEN sinon).
router.get(
  '/protected/admin-only',
  authenticate,
  requirePasswordChanged,
  authorizeRoles('ADMIN'),
  (_req, res) => {
    res.json({ message: 'Espace administrateur.' });
  }
);

module.exports = router;
