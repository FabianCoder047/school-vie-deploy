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
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#666666;">Mot de passe par défaut</p>
    <p style="margin:0 0 24px;font-size:30px;font-weight:bold;letter-spacing:3px;font-family:'Courier New',Courier,monospace;">${escapeHtml(password)}</p>
    <p style="margin:0 0 20px;">
      Pour des raisons de sécurité, vous devrez <strong>changer ce mot de passe lors de votre première connexion</strong>.
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#666666;">Pour vous connecter, rendez-vous sur :</p>
    <p style="margin:0;"><a href="${escapeHtml(loginUrl)}" style="color:#111111;font-weight:bold;">${escapeHtml(loginUrl)}</a></p>
  `);
}

module.exports = { welcomeCredentialsTemplate };
