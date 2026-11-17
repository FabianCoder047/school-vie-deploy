// Assemblage de l'application Express : sécurité (helmet, CORS, rate-limit),
// parsing JSON, routes, gestion d'erreurs centralisée.
const path = require('path');
const fs = require('fs');
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
const referentielRoutes = require('./routes/referentielRoutes');
const adminRoutes = require('./routes/adminRoutes');
const directeurRoutes = require('./routes/directeurRoutes');
const secretaireRoutes = require('./routes/secretaireRoutes');
const comptableRoutes = require('./routes/comptableRoutes');
const professeurRoutes = require('./routes/professeurRoutes');
const parentRoutes = require('./routes/parentRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { notificationsRouter, directeurDocumentsRouter } = require('./routes/notificationRoutes');

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

// Fichiers publics autorisés : logo de l'école (les PDF sont générés en
// mémoire — jamais écrits sur disque).
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', index: false }));

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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
