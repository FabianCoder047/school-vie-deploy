// Génération de QR codes (buffer PNG) — jamais écrit dans un fichier,
// embarqués directement dans les PDF ou convertis en data URI.
const QRCode = require('qrcode');

/** QR code en buffer PNG pour encodage dans un PDF pdfkit. */
async function qrBuffer(texte, size = 96) {
  return QRCode.toBuffer(String(texte), {
    type: 'png',
    width: size,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#1e3a8a', light: '#ffffff' },
  });
}

module.exports = { qrBuffer };
