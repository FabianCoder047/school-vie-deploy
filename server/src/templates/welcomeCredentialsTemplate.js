// Template HTML du mail « Vos identifiants de connexion ».
// Gabarit minimaliste (texte noir sur blanc). Le mot de passe en clair
// n'est JAMAIS journalisé côté serveur hors dry-run explicite.
const { mailMinimal, escapeHtml } = require('./mailMinimal');

function welcomeCredentialsTemplate({ prenom, nom, identifier, password, loginUrl }) {
  return mailMinimal(`
    <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(prenom)} ${escapeHtml(nom)}</strong>,</p>
    <p style="margin:0 0 20px;">
      Un compte vient d’être créé pour vous sur <strong>School Vie</strong>,
      l’espace de gestion de votre établissement scolaire. Voici vos identifiants de connexion :
    </p>
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#666666;">Identifiant</p>
    <p style="margin:0 0 20px;font-size:17px;font-weight:bold;">${escapeHtml(identifier)}</p>
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#666666;">Mot de passe provisoire</p>
    <div style="margin:0 0 24px;display:inline-block;padding:10px 14px;background:#f4f6fa;border:1px solid #d7deea;border-radius:8px;user-select:all;-webkit-user-select:all;cursor:copy;">
      <span style="font-size:24px;font-weight:bold;letter-spacing:2px;font-family:'Courier New',Courier,monospace;word-break:break-all;">${escapeHtml(password)}</span>
      <span style="display:inline-block;margin-left:14px;padding:5px 12px;background:#1d4ed8;color:#ffffff;border-radius:6px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0;">Copier</span>
    </div>
    <p style="margin:0 0 20px;">
      Pour des raisons de sécurité, vous devrez <strong>changer ce mot de passe lors de votre première connexion</strong>.
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#666666;">Pour vous connecter, rendez-vous sur :</p>
    <p style="margin:0;"><a href="${escapeHtml(loginUrl)}" style="color:#111111;font-weight:bold;">${escapeHtml(loginUrl)}</a></p>
  `);
}

module.exports = { welcomeCredentialsTemplate };
