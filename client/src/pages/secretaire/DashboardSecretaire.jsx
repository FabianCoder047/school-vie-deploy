// Tableau de bord Secrétaire : KPI réels + effectifs par cycle.
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import api from '../../api/axios';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import { IconStudent, IconGrid, IconClock, IconReceipt } from '../../layouts/sidebarIcons';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function DashboardSecretaire() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get('/secretaire/dashboard').then(({ data }) => setDonnees(data)).catch(() => setErreur('Impossible de charger le tableau de bord.'));
  }, []);

  if (erreur) return <div className="auth-erreur" role="alert">{erreur}</div>;
  if (!donnees) {
    return (
      <>
        <h1 className="page-titre">Tableau de bord — Secrétaire</h1>
        <div className="grid-4 mb-4">{[1, 2, 3, 4].map((i) => <div key={i} className="stat-card"><div className="spinner" style={{ margin: '12px auto' }} /></div>)}</div>
      </>
    );
  }

  const graphique = {
    labels: donnees.effectifsParCycle.map((l) => l.cycle),
    datasets: [{
      label: 'Élèves',
      data: donnees.effectifsParCycle.map((l) => l.effectif),
      backgroundColor: '#1d4ed8',
      borderRadius: 6,
      maxBarThickness: 64,
    }],
  };

  return (
    <>
      <h1 className="page-titre">Tableau de bord — Secrétaire</h1>
      {donnees.anneeCourante && <p className="text-doux mb-4">Année académique courante : <strong>{donnees.anneeCourante}</strong></p>}

      <div className="grid-4 mb-4">
        <StatCard label="Inscriptions du jour" valeur={donnees.inscriptionsDuJour} tonalite=""><IconReceipt /></StatCard>
        <StatCard label="Inscriptions du mois" valeur={donnees.inscriptionsDuMois} tonalite="jaune"><IconStudent /></StatCard>
        <StatCard label="Élèves inscrits" valeur={donnees.totalEleves} tonalite="vert"><IconStudent /></StatCard>
        <StatCard label="En attente de paiement" valeur={donnees.inscriptionsEnAttente} tonalite="rouge"><IconClock /></StatCard>
      </div>

      <Card titre="Effectif par cycle">
        <div style={{ maxWidth: 640 }}>
          <Bar data={graphique} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
        </div>
      </Card>
    </>
  );
}
