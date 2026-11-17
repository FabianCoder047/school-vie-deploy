// Signature du directeur tracée DANS l'application (souris ou doigt) OU uploadée.
// La signature enregistrée est utilisée au dos des cartes scolaires ("Le Directeur").
// L'administrateur ne peut pas la définir : c'est la signature du directeur lui-même.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const settingsService = require('../services/settingsService');
const { ApiError } = require('../utils/ApiError');

const DOSSIER_SIGNATURE = path.join(__dirname, '..', '..', 'uploads', 'signature');
const PREFIXE = '/uploads/signature/';

/** POST /api/directeur/signature — body { image: "data:image/png;base64,..." } (dessinée) */
async function definirSignatureDessinee(req, res, next) {
  try {
    const image = String(req.body?.image || '');
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(image);
    if (!match) throw ApiError.badRequest('Signature invalide (PNG attendu).', 'SIGNATURE_INVALIDE');
    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.length === 0) throw ApiError.badRequest('Image vide.', 'SIGNATURE_INVALIDE');
    if (buffer.length > 1024 * 1024) throw ApiError.badRequest('Image trop lourde (1 Mo maximum).', 'SIGNATURE_TROP_LOURDE');
    // Vérification des octets magiques PNG
    if (buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
      throw ApiError.badRequest('Fichier PNG invalide.', 'SIGNATURE_INVALIDE');
    }
    fs.mkdirSync(DOSSIER_SIGNATURE, { recursive: true });
    const nomFichier = `signature-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;
    fs.writeFileSync(path.join(DOSSIER_SIGNATURE, nomFichier), buffer);
    const settings = await settingsService.definirSignaturePath(`${PREFIXE}${nomFichier}`, req.user.id, req.ip);
    res.json(settings);
  } catch (err) { next(err); }
}

/** POST /api/directeur/signature/image — multipart "signature" (PNG/JPEG/WebP ≤ 2 Mo), pour ceux qui n'arrivent pas à signer à la main. */
async function definirSignatureUploadee(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest('Aucun fichier reçu.', 'FICHIER_REQUIS');
    const settings = await settingsService.definirSignature(req.file, req.user.id, req.ip);
    res.json(settings);
  } catch (err) { next(err); }
}

/** DELETE /api/directeur/signature */
async function supprimerSignature(req, res, next) {
  try { res.json(await settingsService.supprimerSignature(req.user.id, req.ip)); } catch (err) { next(err); }
}

module.exports = { definirSignatureDessinee, definirSignatureUploadee, supprimerSignature };
