// Mot de passe oublié : réponse toujours générique côté API.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { messageErreur } from '../api/axios';
import Button from '../components/Button';
import Input from '../components/Input';
import AuthVisual from '../components/AuthVisual';
import { MailIcon } from '../components/icons';
import logo from '../assets/logo.svg';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');
    setEnvoi(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { identifier: identifier.trim() });
      setMessage(data.message || 'Si un compte correspond, un e-mail vient d’être envoyé.');
    } catch (err) {
      setErreur(messageErreur(err, 'Une erreur est survenue. Réessayez.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        {/* Visuel animé à GAUCHE */}
        <AuthVisual />

        <main className="auth-formulaire">
          <form className="auth-carte" onSubmit={onSubmit} noValidate>
            <img src={logo} alt="Logo de l'établissement" className="auth-logo" />
            <h1 className="auth-titre">Mot de passe oublié</h1>
            <p className="auth-sous-titre">Indiquez votre e-mail ou votre téléphone : nous vous enverrons un lien de réinitialisation.</p>

            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            {message && <div className="auth-succes" role="status">{message}</div>}

            <Input label="E-mail ou téléphone" name="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} requis autoFocus placeholder="ex. paul@example.com" />

            <Button type="submit" variant="primary" size="lg" className="w-100 mt-6 auth-bouton" disabled={envoi || !identifier.trim()}>
              <MailIcon />
              {envoi ? 'Envoi…' : 'Envoyer le lien'}
            </Button>

            <div style={{ marginTop: 'var(--espace-4)' }}>
              <Link to="/connexion" className="auth-lien">← Retour à la connexion</Link>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
