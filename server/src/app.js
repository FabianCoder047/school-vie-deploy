// Assemblage de l'application Express : sécurité (helmet, CORS, rate-limit),
// parsing JSON, routes, gestion d'erreurs centralisée.
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { globalLimiter } = require('./middlewares/rateLimit');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { authenticate } = require('./middlewares/authenticate');
const { requirePasswordChanged, authorizeRoles } = require('./middlewares/authorizeRoles');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const { maintenanceGuard } = require('./middlewares/maintenanceGuard');
const referentielRoutes = require('./routes/referentielRoutes');
const adminRoutes = require('./routes/adminRoutes');
const directeurRoutes = require('./routes/directeurRoutes');
const secretaireRoutes = require('./routes/secretaireRoutes');
const comptableRoutes = require('./routes/comptableRoutes');
const professeurRoutes = require('./routes/professeurRoutes');
const parentRoutes = require('./routes/parentRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { notificationsRouter, directeurDocumentsRouter } = require('./routes/notificationRoutes');
const { DOSSIER_UPLOADS } = require('./config/uploads');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false, // l'API ne sert que du JSON ; la CSP relève du front
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // photos/logo servis au front
  })
);

app.use(
  cors({
    origin: env.clientUrl,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'], // le front lit le nom de fichier du PDF
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(globalLimiter);

// Statut public de la maintenance (page de garde du front) — toujours servi.
app.use('/api', maintenanceRoutes);
// Tout le reste est inactif pour les non-admins pendant la maintenance.
app.use(maintenanceGuard);

// Fichiers publics autorisés : logo de l'école (les PDF sont générés en
// mémoire — jamais écrits sur disque).
fs.mkdirSync(DOSSIER_UPLOADS, { recursive: true });
app.use('/uploads', express.static(DOSSIER_UPLOADS, { maxAge: '7d', index: false }));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);

// Lecture des référentiels : tout rôle connecté dont le mot de passe est à jour.
app.use('/api', authenticate, requirePasswordChanged, referentielRoutes);
// Espaces par rôle (contrôle côté API, pas seulement côté front).
app.use('/api/admin', authenticate, requirePasswordChanged, authorizeRoles('ADMIN'), adminRoutes);
app.use('/api/directeur', authenticate, requirePasswordChanged, authorizeRoles('DIRECTEUR'), directeurRoutes);
app.use('/api/secretaire', authenticate, requirePasswordChanged, authorizeRoles('SECRETAIRE'), secretaireRoutes);
app.use('/api/comptable', authenticate, requirePasswordChanged, authorizeRoles('COMPTABLE'), comptableRoutes);
app.use('/api/professeur', authenticate, requirePasswordChanged, authorizeRoles('PROFESSEUR'), professeurRoutes);
app.use('/api/parent', authenticate, requirePasswordChanged, authorizeRoles('PARENT'), parentRoutes);
// Profil : accessible à tous les rôles (mot de passe à jour requis)
app.use('/api/profile', profileRoutes);
// Notifications : tout rôle connecté dont le mot de passe est à jour
app.use('/api/notifications', authenticate, requirePasswordChanged, notificationsRouter);
// Documents PDF + communiqués : Directeur uniquement
app.use('/api/directeur', authenticate, requirePasswordChanged, authorizeRoles('DIRECTEUR'), directeurDocumentsRouter);

// Déploiement "tout-en-un" (Docker) : le même serveur Express sert l'API et
// la SPA compilée par Vite. Les routes React inconnues renvoient index.html
// (équivalent du _redirects du Static Site Render).
if (process.env.FRONTEND_DIST_DIR && fs.existsSync(process.env.FRONTEND_DIST_DIR)) {
  const dist = process.env.FRONTEND_DIST_DIR;
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
