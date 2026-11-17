// Gabarit d'e-mail minimaliste (style "Vercel") :
// texte noir sur fond blanc, aucun bandeau coloré, aucune "carte",
// séparateur fin puis marque en pied. Toute valeur interpolée passe par escapeHtml.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/**
 * Enrobe le corps HTML dans le gabarit minimal commun.
 * @param {string} corpsHtml contenu déjà échappé/formaté
 */
function mailMinimal(corpsHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>School Vie</title></head>
<body style="margin:0;padding:32px 16px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111111;">
  <div style="max-width:560px;margin:0 auto;font-size:15px;line-height:1.6;">
    ${corpsHtml}
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0 16px;">
    <p style="margin:0;font-size:12px;color:#666666;">School Vie — message automatique, merci de ne pas y répondre.</p>
  </div>
</body>
</html>`;
}

module.exports = { mailMinimal, escapeHtml };
