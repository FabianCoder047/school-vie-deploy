// Page de garde affichée PENDANT la maintenance à tout le monde SAUF le rôle
// ADMIN (qui continue de voir le site avec un bandeau d'information).
import { useAuth } from '../hooks/useAuth';
import { useMaintenance } from '../context/MaintenanceContext';
import Button from '../components/Button';
import logoDefaut from '../assets/logo.svg';

const URL_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ORIGINE = URL_API.replace(/\/api\/?$/, '');

function dateFr(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function MaintenancePage() {
  const { user, deconnexion } = useAuth();
  const { message, debut, fin, etablissement } = useMaintenance();

  const logo = etablissement?.logo_path ? `${ORIGINE}${etablissement.logo_path}` : logoDefaut;
  const nomEtablissement = etablissement?.nom || 'School Vie';

  return (
    <div className="maintenance-page">
      <div className="maintenance-orbe maintenance-orbe--1" />
      <div className="maintenance-orbe maintenance-orbe--2" />

      <main className="maintenance-carte" role="main">
        <img className="maintenance-logo" src={logo} alt={`Logo — ${nomEtablissement}`} />
        <p className="maintenance-ecole">{nomEtablissement}</p>

        <span className="maintenance-badge"><span className="maintenance-badge-point" />Maintenance</span>
        <h1 className="maintenance-titre">Le site est en maintenance</h1>
        <p className="maintenance-message">{message}</p>

        {debut && fin && (
          <p className="maintenance-periode">
            Du <strong>{dateFr(debut)}</strong> au <strong>{dateFr(fin)}</strong>
          </p>
        )}

        <p className="maintenance-note">
          Le site sera de nouveau disponible automatiquement à la fin de la maintenance — aucune action n’est nécessaire de votre part.
        </p>

        {user && user.role !== 'ADMIN' && (
          <div>
            <p className="maintenance-note" style={{ marginBottom: 'var(--espace-3)' }}>
              Vous êtes connecté en tant que <strong>{user.prenom} {user.nom}</strong> — votre session reprendra dès la fin de la maintenance.
            </p>
            <Button variant="outline" onClick={deconnexion}>Se déconnecter</Button>
          </div>
        )}

        <p className="maintenance-pied">School Vie — Gestion d’établissement scolaire</p>
      </main>
    </div>
  );
}
