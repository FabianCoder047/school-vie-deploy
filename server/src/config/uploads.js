// Chemin unique du dossier des fichiers uploadés (photos, logo, signature,
// cachet, justificatifs). Toutes les écritures ET lectures passent ici :
// en production Render, UPLOADS_DIR pointe vers le disque persistant /data.
const path = require('path');
const env = require('./env');

const DOSSIER_UPLOADS = path.resolve(env.uploadsDir);
const URL_PUBLIQUE = '/uploads';

module.exports = { DOSSIER_UPLOADS, URL_PUBLIQUE };
