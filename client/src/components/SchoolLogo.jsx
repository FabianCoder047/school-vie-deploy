// Logo de l'établissement, partout dans l'application.
// source : réglage « Paramètres de l'école » (upload du Directeur), exposé
// publiquement par /api/maintenance/status — donc disponible même sur les
// pages de connexion, hors session. Repli sur le logo par défaut School Vie.
import logoDefaut from '../assets/logo.svg';
import { useMaintenance } from '../context/MaintenanceContext';
import { urlUpload } from '../utils/uploads';

export default function SchoolLogo({ className = '', style, alt = 'Logo de l’établissement' }) {
  const { etablissement } = useMaintenance();
  const src = etablissement?.logo_path ? urlUpload(etablissement.logo_path) : logoDefaut;
  return <img src={src} alt={alt} className={className} style={style} />;
}
