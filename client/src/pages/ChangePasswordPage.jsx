// Changement de mot de passe obligatoire à la première connexion
// (accessible aussi ensuite depuis n'importe quel espace).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { messageErreur } from '../api/axios';
import Button from '../components/Button';
import PasswordInput from '../components/PasswordInput';
import AuthVisual from '../components/AuthVisual';
import { KeyIcon } from '../components/icons';
import logo from '../assets/logo.svg';

const REGLES = [
  { id: 'longueur', label: 'Au moins 8 caractères', test: (v) => v.length >= 8 },
  { id: 'minuscule', label: 'Une minuscule', test: (v) => /[a-z]/.test(v) },
  { id: 'majuscule', label: 'Une majuscule', test: (v) => /[A-Z]/.test(v) },
  { id: 'chiffre', label: 'Un chiffre', test: (v) => /[0-9]/.test(v) },
];

export default function ChangePasswordPage() {
  const { user, changerMotDePasse, tableauDeBord } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const force = Boolean(user?.mustChangePassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const motsDePasseValides = REGLES.every((r) => r.test(newPassword));
  const identiques = newPassword.length > 0 && newPassword === confirmation;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!motsDePasseValides) {
      setErreur('Le nouveau mot de passe ne respecte pas toutes les règles.');
      return;
    }
    if (!identiques) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setEnvoi(true);
    try {
      await changerMotDePasse(currentPassword, newPassword);
      toast.succes('Mot de passe mis à jour. Bienvenue !');
      navigate(tableauDeBord, { replace: true });
    } catch (err) {
      setErreur(messageErreur(err, 'Impossible de changer le mot de passe.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout auth-layout--inverse">
        {/* Formulaire à GAUCHE */}
        <main className="auth-formulaire">
          <form className="auth-carte" onSubmit={onSubmit} noValidate>
            <img src={logo} alt="Logo de l'établissement" className="auth-logo" />
            <h1 className="auth-titre">{force ? 'Changement de mot de passe' : 'Changer votre mot de passe'}</h1>
            <p className="auth-sous-titre">
              {force
                ? 'Votre mot de passe par défaut doit être remplacé avant de continuer.'
                : 'Choisissez un nouveau mot de passe sécurisé.'}
            </p>

            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}

            <PasswordInput label="Mot de passe actuel" name="currentPassword" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} requis autoFocus />
            <div className="mt-4">
              <PasswordInput label="Nouveau mot de passe" name="newPassword" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} requis />
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', textAlign: 'left' }}>
              {REGLES.map((regle) => {
                const ok = regle.test(newPassword);
                return (
                  <li key={regle.id} style={{ fontSize: 12, color: ok ? 'var(--vert-700)' : 'var(--gris-500)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span aria-hidden="true">{ok ? '✓' : '○'}</span>{regle.label}
                  </li>
                );
              })}
            </ul>
            <div className="mt-4">
              <PasswordInput label="Confirmer le nouveau mot de passe" name="confirmation" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} requis erreur={confirmation && !identiques ? 'Les mots de passe ne correspondent pas.' : undefined} />
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-100 mt-6 auth-bouton" disabled={envoi || !motsDePasseValides || !identiques}>
              <KeyIcon />
              {envoi ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </Button>
          </form>
        </main>

        {/* Visuel animé à DROITE */}
        <AuthVisual />
      </div>
    </div>
  );
}
