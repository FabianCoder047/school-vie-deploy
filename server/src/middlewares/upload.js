// Upload de fichiers image (logo de l'école, photos des élèves).
// PNG/JPEG/WebP, 2 Mo max, nom de fichier aléatoire.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { ApiError } = require('../utils/ApiError');

const DOSSIER_UPLOADS = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(DOSSIER_UPLOADS, { recursive: true });

const MIME_EXTENSIONS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const MIME_JUSTIFICATIF = { ...MIME_EXTENSIONS, 'application/pdf': '.pdf' };

function fabriquerUploadImage(sousDossier) {
  const destination = path.join(DOSSIER_UPLOADS, sousDossier);
  fs.mkdirSync(destination, { recursive: true });
  const storage = multer.diskStorage({
    destination,
    filename: (_req, file, cb) => {
      const ext = MIME_EXTENSIONS[file.mimetype] || path.extname(file.originalname).toLowerCase();
      cb(null, `${sousDossier}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!MIME_EXTENSIONS[file.mimetype]) {
        return cb(ApiError.badRequest('Format non accepté : utilisez un PNG, JPEG ou WebP.', 'FORMAT_INVALIDE'));
      }
      cb(null, true);
    },
  });
}

const uploadLogo = fabriquerUploadImage('logo');
const uploadPhoto = fabriquerUploadImage('photos');
const uploadSignature = fabriquerUploadImage('signature');
const uploadCachet = fabriquerUploadImage('cachet');
/** Reçu scanné (photo/PDF du reçu rempli à la main) — 5 Mo. */
const uploadJustificatif = (() => {
  const sousDossier = 'justificatifs';
  const destination = path.join(DOSSIER_UPLOADS, sousDossier);
  fs.mkdirSync(destination, { recursive: true });
  const storage = multer.diskStorage({
    destination,
    filename: (_req, file, cb) => {
      const ext = MIME_JUSTIFICATIF[file.mimetype] || path.extname(file.originalname).toLowerCase();
      cb(null, `${sousDossier}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!MIME_JUSTIFICATIF[file.mimetype]) {
        return cb(ApiError.badRequest('Format non accepté : utilisez un PDF ou une image (PNG, JPEG, WebP).', 'FORMAT_INVALIDE'));
      }
      cb(null, true);
    },
  });
})();

// Restauration : upload en MÉMOIRE uniquement (jamais sur disque)
const uploadBackupMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/json' || /\.json$/i.test(file.originalname || '');
    if (!ok) return cb(ApiError.badRequest('La restauration n’accepte que des fichiers JSON produits par cette application.', 'FORMAT_INVALIDE'));
    cb(null, true);
  },
});

/** Erreur Multer → ApiError lisible. */
function multerErrorHandler(err, _req, _res, next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return next(ApiError.badRequest('Fichier trop volumineux (maximum 2 Mo).', 'FICHIER_TROP_GROS'));
  }
  next(err);
}

module.exports = { uploadLogo, uploadPhoto, uploadSignature, uploadCachet, uploadBackupMemory, uploadJustificatif, multerErrorHandler, DOSSIER_UPLOADS };
