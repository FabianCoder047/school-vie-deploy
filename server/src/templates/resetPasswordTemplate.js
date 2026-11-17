// Template HTML du mail de réinitialisation de mot de passe.
// Gabarit minimaliste (texte noir sur blanc).
const { mailMinimal, escapeHtml } = require('./mailMinimal');

function resetPasswordTemplate({ prenom, nom, resetUrl, expiresMinutes }) {
  return mailMinimal(`
    <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(prenom)} ${escapeHtml(nom)}</strong>,</p>
    <p style="margin:0 0 16px;">
      Une réinitialisation de votre mot de passe a été demandée sur <strong>School Vie</strong>.
      Pour choisir un nouveau mot de passe, suivez ce lien :
    </p>
    <p style="margin:0 0 24px;font-size:17px;font-weight:bold;word-break:break-all;">
      <a href="${escapeHtml(resetUrl)}" style="color:#111111;">${escapeHtml(resetUrl)}</a>
    </p>
    <p style="margin:0 0 16px;">
      Ce lien expire dans <strong>${escapeHtml(expiresMinutes)} minutes</strong> et ne peut être utilisé qu’une seule fois.
    </p>
    <p style="margin:0;font-size:13px;color:#666666;">Si vous n’êtes pas à l’origine de cette demande, ignorez simplement ce message.</p>
  `);
}

module.exports = { resetPasswordTemplate };
