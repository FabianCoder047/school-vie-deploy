// Utilisateurs de l'école (Directeur) : Secrétaire, Comptable, Professeur.
import AccountsManager from '../_shared/AccountsManager';

export default function UtilisateursPage() {
  return (
    <AccountsManager
      endpoint="/directeur/utilisateurs"
      rolesDisponibles={[
        { value: 'SECRETAIRE', label: 'Secrétaire' },
        { value: 'COMPTABLE', label: 'Comptable' },
        { value: 'PROFESSEUR', label: 'Professeur' },
      ]}
      titre="Utilisateurs de l’école"
      sousTitre="Comptes Secrétaire, Comptable et Professeur. Un mot de passe temporaire est envoyé par e-mail ; le changement est exigé à la première connexion."
    />
  );
}
