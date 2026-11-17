// Comptes Directeur (Administrateur uniquement).
import AccountsManager from '../_shared/AccountsManager';

export default function DirecteursPage() {
  return (
    <AccountsManager
      endpoint="/admin/directeurs"
      rolesDisponibles={[{ value: 'DIRECTEUR', label: 'Directeur' }]}
      titre="Directeurs"
      sousTitre="Créez le ou les comptes Directeur de votre établissement. Un mot de passe temporaire est envoyé par e-mail ; le changement est exigé à la première connexion."
    />
  );
}
