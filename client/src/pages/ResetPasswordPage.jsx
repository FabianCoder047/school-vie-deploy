// Réinitialisation via le lien reçu par e-mail (?token=…).
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { messageErreur } from '../api/axios';
import Button from '../components/Button';
import PasswordInput from '../components/PasswordInput';
import AuthVisual from '../components/AuthVisual';
import { KeyIcon, LoginIcon } from '../components/icons';
import logo from '../assets/logo.svg';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  const identiques = newPassword.length > 0 && newPassword === confirmation;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    if (!identiques) {
      setErreur('La confirmation ne correspond pas.');
      return;
    }
    setEnvoi(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, newPassword });
      setMessage(data.message || 'Mot de passe réinitialisé.');
    } catch (err) {
      setErreur(messageErreur(err, 'Lien invalide ou expiré.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout auth-layout--inverse">
        <main className="auth-formulaire">
          <form className="auth-carte" onSubmit={onSubmit} noValidate>
            <img src={logo} alt="Logo de l'établissement" className="auth-logo" />
            <h1 className="auth-titre">Réinitialiser le mot de passe</h1>
            <p className="auth-sous-titre">Choisissez un nouveau mot de passe (8 caractères minimum, avec majuscule, minuscule et chiffre).</p>

            {!token && <div className="auth-erreur" role="alert">Lien incomplet : le jeton de réinitialisation est manquant.</div>}
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            {message && <div className="auth-succes" role="status">{message}</div>}

            <PasswordInput label="Nouveau mot de passe" name="newPassword" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} requis disabled={Boolean(message)} />
            <div className="mt-4">
              <PasswordInput label="Confirmer le mot de passe" name="confirmation" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} requis erreur={confirmation && !identiques ? 'Les mots de passe ne correspondent pas.' : undefined} disabled={Boolean(message)} />
            </div>

            {!message ? (
              <Button type="submit" variant="primary" size="lg" className="w-100 mt-6 auth-bouton" disabled={envoi || !token || !newPassword || !identiques}>
                <KeyIcon />
                {envoi ? 'Enregistrement…' : 'Réinitialiser'}
              </Button>
            ) : (
              <Link to="/connexion" className="btn btn-primary btn-lg w-100 mt-6 auth-bouton" style={{ textDecoration: 'none' }}>
                <LoginIcon />
                Se connecter
              </Link>
            )}
          </form>
        </main>

        {/* Visuel animé à DROITE */}
        <AuthVisual />
      </div>
    </div>
  );
}
