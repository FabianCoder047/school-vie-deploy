import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRedirect from './routes/RoleRedirect';
import { useAuth } from './hooks/useAuth';
import { useMaintenance } from './context/MaintenanceContext';
import MaintenancePage from './pages/MaintenancePage';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import EnConstructionPage from './pages/EnConstructionPage';
import DashboardAdmin from './pages/admin/DashboardAdmin';
import Cycles from './pages/admin/Cycles';
import Classes from './pages/admin/Classes';
import Matieres from './pages/admin/Matieres';
import Annees from './pages/admin/Annees';
import Directeurs from './pages/admin/Directeurs';
import Parametres from './pages/directeur/Parametres';
import DashboardDirecteur from './pages/directeur/DashboardDirecteur';
import Utilisateurs from './pages/directeur/Utilisateurs';
import Alias from './pages/directeur/Alias';
import Affectations from './pages/directeur/Affectations';
import Frais from './pages/directeur/Frais';
import DashboardSecretaire from './pages/secretaire/DashboardSecretaire';
import NouvelEleve from './pages/secretaire/NouvelEleve';
import Eleves from './pages/secretaire/Eleves';
import DashboardComptable from './pages/comptable/DashboardComptable';
import Paiements from './pages/comptable/Paiements';
import Comptes from './pages/comptable/Comptes';
import Relances from './pages/comptable/Relances';
import Rapports from './pages/comptable/Rapports';
import DashboardProfesseur from './pages/professeur/DashboardProfesseur';
import SaisieNotes from './pages/professeur/SaisieNotes';
import Appel from './pages/professeur/Appel';
import MonEmploiDuTemps from './pages/professeur/MonEmploiDuTemps';
import Periodes from './pages/directeur/Periodes';
import EmploiDuTemps from './pages/directeur/EmploiDuTemps';
import Sauvegardes from './pages/admin/Sauvegardes';
import Journal from './pages/admin/Journal';
import ListeRenvoi from './pages/comptable/ListeRenvoi';
import CommuniquesLecture from './pages/_shared/CommuniquesLecture';
import EmploiDuTempsEspace from './pages/_shared/EmploiDuTempsEspace';
import CartesEspace from './pages/_shared/CartesEspace';
import BulletinsEspace from './pages/_shared/BulletinsEspace';
import ProclamationsEspace from './pages/_shared/ProclamationsEspace';
import CommuniquesEspace from './pages/_shared/CommuniquesEspace';
import ProfilPage from './pages/ProfilPage';
import CartesScolaires from './pages/directeur/CartesScolaires';
import Bulletins from './pages/directeur/Bulletins';
import Proclamations from './pages/directeur/Proclamations';
import StatistiquesPresences from './pages/directeur/StatistiquesPresences';
import Communiques from './pages/directeur/Communiques';
import Notes from './pages/parent/Notes';
import AbsencesParent from './pages/parent/Absences';
import AbsencesEleves from './pages/professeur/AbsencesEleves';
import EmploiDuTempsEnfant from './pages/parent/EmploiDuTemps';
import Finance from './pages/parent/Finance';
import DashboardParent from './pages/parent/DashboardParent';
import MaintenanceAdmin from './pages/admin/Maintenance';

export default function App() {
  const { user, chargement } = useAuth();
  const maintenance = useMaintenance();

  // Garde globale : pendant la maintenance, personne n'accède au site SAUF
  // l'administrateur (qui voit le site complet + un bandeau d'information).
  if (chargement || maintenance.chargement) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" aria-label="Chargement…" />
      </div>
    );
  }
  if (maintenance.active && user?.role !== 'ADMIN') {
    return <MaintenancePage />;
  }

  return (
    <Routes>
      {/* Pages publiques */}
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />

      {/* Changement de mot de passe forcé (accessible sans layout) */}
      <Route
        path="/changer-mot-de-passe"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Espace authentifié avec layout (sidebar + topbar) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleRedirect />} />
        <Route path="admin" element={<ProtectedRoute roles={['ADMIN']}><DashboardAdmin /></ProtectedRoute>} />
        <Route path="admin/cycles" element={<ProtectedRoute roles={['ADMIN']}><Cycles /></ProtectedRoute>} />
        <Route path="admin/classes" element={<ProtectedRoute roles={['ADMIN']}><Classes /></ProtectedRoute>} />
        <Route path="admin/matieres" element={<ProtectedRoute roles={['ADMIN']}><Matieres /></ProtectedRoute>} />
        <Route path="admin/annees" element={<ProtectedRoute roles={['ADMIN']}><Annees /></ProtectedRoute>} />
        <Route path="admin/directeurs" element={<ProtectedRoute roles={['ADMIN']}><Directeurs /></ProtectedRoute>} />
        <Route path="directeur" element={<ProtectedRoute roles={['DIRECTEUR']}><DashboardDirecteur /></ProtectedRoute>} />
        <Route path="directeur/utilisateurs" element={<ProtectedRoute roles={['DIRECTEUR']}><Utilisateurs /></ProtectedRoute>} />
        <Route path="directeur/alias" element={<ProtectedRoute roles={['DIRECTEUR']}><Alias /></ProtectedRoute>} />
        <Route path="directeur/affectations" element={<ProtectedRoute roles={['DIRECTEUR']}><Affectations /></ProtectedRoute>} />
        <Route path="directeur/parametres" element={<ProtectedRoute roles={['DIRECTEUR']}><Parametres /></ProtectedRoute>} />
        <Route path="directeur/frais" element={<ProtectedRoute roles={['DIRECTEUR']}><Frais /></ProtectedRoute>} />
        <Route path="directeur/periodes" element={<ProtectedRoute roles={['DIRECTEUR']}><Periodes /></ProtectedRoute>} />
        <Route path="directeur/edt" element={<ProtectedRoute roles={['DIRECTEUR']}><EmploiDuTemps /></ProtectedRoute>} />
        <Route path="admin/sauvegardes" element={<ProtectedRoute roles={['ADMIN']}><Sauvegardes /></ProtectedRoute>} />
        <Route path="admin/journal" element={<ProtectedRoute roles={['ADMIN']}><Journal /></ProtectedRoute>} />
        <Route path="admin/maintenance" element={<ProtectedRoute roles={['ADMIN']}><MaintenanceAdmin /></ProtectedRoute>} />
        <Route path="profil" element={<ProtectedRoute><ProfilPage /></ProtectedRoute>} />
        <Route path="directeur/cartes" element={<ProtectedRoute roles={['DIRECTEUR']}><CartesScolaires /></ProtectedRoute>} />
        <Route path="directeur/bulletins" element={<ProtectedRoute roles={['DIRECTEUR']}><Bulletins /></ProtectedRoute>} />
        <Route path="directeur/proclamations" element={<ProtectedRoute roles={['DIRECTEUR']}><Proclamations /></ProtectedRoute>} />
        <Route path="directeur/statistiques-presences" element={<ProtectedRoute roles={['DIRECTEUR']}><StatistiquesPresences base="/directeur" peutVoirDetail /></ProtectedRoute>} />
        <Route path="directeur/communiques" element={<ProtectedRoute roles={['DIRECTEUR']}><Communiques /></ProtectedRoute>} />
        <Route path="professeur" element={<ProtectedRoute roles={['PROFESSEUR']}><DashboardProfesseur /></ProtectedRoute>} />
        <Route path="professeur/notes" element={<ProtectedRoute roles={['PROFESSEUR']}><SaisieNotes /></ProtectedRoute>} />
        <Route path="professeur/appel" element={<ProtectedRoute roles={['PROFESSEUR']}><Appel /></ProtectedRoute>} />
        <Route path="professeur/edt" element={<ProtectedRoute roles={['PROFESSEUR']}><MonEmploiDuTemps /></ProtectedRoute>} />
        <Route path="professeur/absences-eleves" element={<ProtectedRoute roles={['PROFESSEUR']}><AbsencesEleves /></ProtectedRoute>} />
        <Route path="secretaire" element={<ProtectedRoute roles={['SECRETAIRE']}><DashboardSecretaire /></ProtectedRoute>} />
        <Route path="secretaire/nouvel-eleve" element={<ProtectedRoute roles={['SECRETAIRE']}><NouvelEleve /></ProtectedRoute>} />
        <Route path="secretaire/eleves" element={<ProtectedRoute roles={['SECRETAIRE']}><Eleves /></ProtectedRoute>} />
        <Route path="secretaire/statistiques-presences" element={<ProtectedRoute roles={['SECRETAIRE']}><StatistiquesPresences base="/secretaire" /></ProtectedRoute>} />
        <Route path="secretaire/edt" element={<ProtectedRoute roles={['SECRETAIRE']}><EmploiDuTempsEspace espace="secretaire" /></ProtectedRoute>} />
        <Route path="secretaire/cartes" element={<ProtectedRoute roles={['SECRETAIRE']}><CartesEspace espace="secretaire" /></ProtectedRoute>} />
        <Route path="secretaire/bulletins" element={<ProtectedRoute roles={['SECRETAIRE']}><BulletinsEspace espace="secretaire" /></ProtectedRoute>} />
        <Route path="secretaire/proclamations" element={<ProtectedRoute roles={['SECRETAIRE']}><ProclamationsEspace espace="secretaire" /></ProtectedRoute>} />
        <Route path="secretaire/communiques" element={<ProtectedRoute roles={['SECRETAIRE']}><CommuniquesEspace espace="secretaire" /></ProtectedRoute>} />
        <Route path="comptable" element={<ProtectedRoute roles={['COMPTABLE']}><DashboardComptable /></ProtectedRoute>} />
        <Route path="comptable/paiements" element={<ProtectedRoute roles={['COMPTABLE']}><Paiements /></ProtectedRoute>} />
        <Route path="comptable/comptes" element={<ProtectedRoute roles={['COMPTABLE']}><Comptes /></ProtectedRoute>} />
        <Route path="comptable/relances" element={<ProtectedRoute roles={['COMPTABLE']}><Relances /></ProtectedRoute>} />
        <Route path="comptable/rapports" element={<ProtectedRoute roles={['COMPTABLE']}><Rapports /></ProtectedRoute>} />
        <Route path="comptable/liste-renvoi" element={<ProtectedRoute roles={['COMPTABLE']}><ListeRenvoi /></ProtectedRoute>} />
        <Route path="parent" element={<ProtectedRoute roles={['PARENT']}><DashboardParent /></ProtectedRoute>} />
        <Route path="parent/notes" element={<ProtectedRoute roles={['PARENT']}><Notes /></ProtectedRoute>} />
        <Route path="parent/absences" element={<ProtectedRoute roles={['PARENT']}><AbsencesParent /></ProtectedRoute>} />
        <Route path="parent/edt" element={<ProtectedRoute roles={['PARENT']}><EmploiDuTempsEnfant /></ProtectedRoute>} />
        <Route path="parent/finance" element={<ProtectedRoute roles={['PARENT']}><Finance /></ProtectedRoute>} />
        <Route path="communiques" element={<ProtectedRoute><CommuniquesLecture /></ProtectedRoute>} />
        <Route path="en-construction" element={<EnConstructionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
