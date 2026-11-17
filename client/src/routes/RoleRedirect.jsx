import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Redirige « / » vers le tableau de bord du rôle connecté. */
export default function RoleRedirect() {
  const { tableauDeBord } = useAuth();
  return <Navigate to={tableauDeBord} replace />;
}
