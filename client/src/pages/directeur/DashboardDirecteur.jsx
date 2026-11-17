// Tableau de bord Directeur : KPI réels + utilisateurs par rôle.
import { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import api from '../../api/axios';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import { IconUsers, IconGrid, IconBook, IconLayers, IconStudent, IconCash, IconAlert, IconClock } from '../../layouts/sidebarIcons';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function DashboardDirecteur() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get('/directeur/dashboard').then(({ data }) => setDonnees(data)).catch(() => setErreur('Impossible de charger le tableau de bord.'));
  }, []);

  if (erreur) return <div className="auth-erreur" role="alert">{erreur}</div>;
  if (!donnees) {
    return (
      <>
        <h1 className="page-titre">Tableau de bord — Directeur</h1>
        <div className="grid-4 mb-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="stat-card"><div className="spinner" style={{ margin: '12px auto' }} /></div>)}
        </div>
      </>
    );
  }

  const graphique = {
    labels: donnees.utilisateursParRole.map((l) => l.role),
    datasets: [
      {
        data: donnees.utilisateursParRole.map((l) => l.total),
        backgroundColor: ['#1d4ed8', '#eab308', '#16a34a'],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  return (
    <>
      <h1 className="page-titre">Tableau de bord — Directeur</h1>
      {donnees.anneeCourante && <p className="text-doux mb-4">Année académique courante : <strong>{donnees.anneeCourante}</strong></p>}

      <div className="grid-4 mb-4">
        <StatCard label="Professeurs" valeur={donnees.professeurs} tonalite=""><IconUsers /></StatCard>
        <StatCard label="Secrétaires" valeur={donnees.secretaires} tonalite="jaune"><IconUsers /></StatCard>
        <StatCard label="Comptables" valeur={donnees.comptables} tonalite="vert"><IconUsers /></StatCard>
        <StatCard label="Alias de classe" valeur={donnees.alias} tonalite="rouge"><IconGrid /></StatCard>
      </div>
      <div className="grid-4 mb-4">
        <StatCard label="Classes" valeur={donnees.classes} tonalite=""><IconLayers /></StatCard>
        <StatCard label="Affectations (matière↔classe)" valeur={donnees.affectations} tonalite="jaune"><IconBook /></StatCard>
        <StatCard label="Élèves" valeur={donnees.eleves} tonalite="vert"><IconStudent /></StatCard>
        <StatCard label="Recouvrement" valeur={`${donnees.recouvrement} %`} tonalite="rouge"><IconCash /></StatCard>
      </div>
      <div className="grid-4 mb-4">
        <StatCard label="Absences (mois)" valeur={donnees.absencesMois} tonalite="rouge"><IconAlert /></StatCard>
        <StatCard label="Retards (mois)" valeur={donnees.retardsMois} tonalite="jaune"><IconClock /></StatCard>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card titre="Utilisateurs actifs par rôle">
          <div style={{ maxWidth: 340, margin: '0 auto' }}>
            <Doughnut data={graphique} options={{ plugins: { legend: { position: 'bottom' } } }} />
          </div>
        </Card>
        <Card titre="Année courante">
          <p style={{ fontSize: 40, fontWeight: 800, color: 'var(--bleu-800)' }}>{donnees.anneeCourante || '—'}</p>
          <p className="text-doux">Toutes les affectations de professeurs sont rattachées à cette année (modifiable depuis l’espace Administrateur → Années académiques).</p>
        </Card>
      </div>
    </>
  );
}
