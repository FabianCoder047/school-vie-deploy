// Route protégée : authentification requise, changement de mot de passe
// obligatoire si demandé, contrôle de rôle optionnel.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children, roles }) {
  const { user, chargement, tableauDeBord } = useAuth();
  const location = useLocation();

  if (chargement) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" aria-label="Chargement…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  if (user.mustChangePassword && location.pathname !== '/changer-mot-de-passe') {
    return <Navigate to="/changer-mot-de-passe" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={tableauDeBord} replace />;
  }

  return children;
}
