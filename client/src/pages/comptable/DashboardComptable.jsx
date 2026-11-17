// Tableau de bord Comptable : KPI réels + évolution 30 jours + répartition par moyen.
import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import api from '../../api/axios';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import { IconCash, IconChart, IconAlert, IconBook } from '../../layouts/sidebarIcons';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const MOYEN_LIB = { ESPECES: 'Espèces', FLOOZ: 'Flooz', MIXX_BY_YAS: 'Mixx By Yas' };
const MOYEN_COULEUR = { ESPECES: '#16a34a', FLOOZ: '#eab308', MIXX_BY_YAS: '#1d4ed8' };

export default function DashboardComptable() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get('/comptable/dashboard').then(({ data }) => setDonnees(data)).catch(() => setErreur('Impossible de charger le tableau de bord.'));
  }, []);

  if (erreur) return <div className="auth-erreur" role="alert">{erreur}</div>;
  if (!donnees) {
    return (
      <>
        <h1 className="page-titre">Tableau de bord — Comptable</h1>
        <div className="grid-4 mb-4">{[1, 2, 3, 4].map((i) => <div key={i} className="stat-card"><div className="spinner" style={{ margin: '12px auto' }} /></div>)}</div>
      </>
    );
  }

  const fmt = (n) => `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`;
  const evolution = {
    labels: donnees.evolution.map((l) => new Date(l.jour).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })),
    datasets: [{ label: 'Encaissements', data: donnees.evolution.map((l) => l.total), backgroundColor: '#1d4ed8', borderRadius: 4, maxBarThickness: 28 }],
  };
  const parMoyen = {
    labels: donnees.parMoyen.map((l) => MOYEN_LIB[l.moyen] || l.moyen),
    datasets: [{ data: donnees.parMoyen.map((l) => l.total), backgroundColor: donnees.parMoyen.map((l) => MOYEN_COULEUR[l.moyen] || '#64748b'), borderWidth: 2, borderColor: '#ffffff' }],
  };

  return (
    <>
      <h1 className="page-titre">Tableau de bord — Comptable</h1>
      {donnees.anneeCourante && <p className="text-doux mb-4">Année académique courante : <strong>{donnees.anneeCourante}</strong></p>}

      <div className="grid-4 mb-4">
        <StatCard label="Encaissé du jour" valeur={fmt(donnees.encaisseDuJour)} tonalite="vert"><IconCash /></StatCard>
        <StatCard label="Encaissé du mois" valeur={fmt(donnees.encaisseDuMois)} tonalite=""><IconChart /></StatCard>
        <StatCard label="Impayés" valeur={fmt(donnees.impayes)} tonalite="rouge"><IconAlert /></StatCard>
        <StatCard label="Recouvrement" valeur={`${donnees.tauxRecouvrement} %`} tonalite="jaune"><IconBook /></StatCard>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card titre="Évolution des encaissements (30 jours)">
          <Bar data={evolution} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
        </Card>
        <Card titre="Répartition par moyen de paiement">
          {donnees.parMoyen.length === 0
            ? <p className="text-doux">Aucun encaissement pour l’instant.</p>
            : <div style={{ maxWidth: 320, margin: '0 auto' }}><Doughnut data={parMoyen} options={{ plugins: { legend: { position: 'bottom' } } }} /></div>}
        </Card>
      </div>
    </>
  );
}
