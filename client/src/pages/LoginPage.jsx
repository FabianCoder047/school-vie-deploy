// Page de connexion (identifiant = e-mail ou téléphone).
import { useState } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { messageErreur } from '../api/axios';
import Button from '../components/Button';
import Input from '../components/Input';
import PasswordInput from '../components/PasswordInput';
import AuthVisual from '../components/AuthVisual';
import { LoginIcon } from '../components/icons';
import SchoolLogo from '../components/SchoolLogo';

export default function LoginPage() {
  const { user, chargement, connexion, tableauDeBord } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  // Déjà connecté → tableau de bord.
  if (!chargement && user) {
    const destination = user.mustChangePassword ? '/changer-mot-de-passe' : tableauDeBord;
    return <Navigate to={destination} replace state={{ from: location }} />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const connecte = await connexion(identifier.trim(), password);
      navigate(connecte.mustChangePassword ? '/changer-mot-de-passe' : '/', { replace: true });
    } catch (err) {
      setErreur(messageErreur(err, 'Identifiants invalides.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        {/* Visuel animé à GAUCHE */}
        <AuthVisual />

        {/* Formulaire à DROITE */}
        <main className="auth-formulaire">
          <form className="auth-carte" onSubmit={onSubmit} noValidate>
            <SchoolLogo className="auth-logo" />
            <h1 className="auth-titre">School Vie</h1>
            <p className="auth-sous-titre">Gestion d’établissement scolaire — connectez-vous avec votre e-mail ou votre numéro de téléphone.</p>

            {erreur && (
              <div className="auth-erreur" role="alert">{erreur}</div>
            )}

            <Input
              label="E-mail ou téléphone"
              name="identifier"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="ex. paul@example.com ou 90 00 00 00"
              requis
              autoFocus
            />
            <div className="mt-4">
              <PasswordInput
                label="Mot de passe"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                requis
              />
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-100 mt-6 auth-bouton" disabled={envoi}>
              <LoginIcon />
              {envoi ? 'Connexion…' : 'Se connecter'}
            </Button>

            <div style={{ marginTop: 'var(--espace-4)' }}>
              <Link to="/mot-de-passe-oublie" className="auth-lien">Mot de passe oublié ?</Link>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
