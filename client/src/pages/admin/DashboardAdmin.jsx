// Tableau de bord Administrateur : KPI réels + classes par cycle.
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import api from '../../api/axios';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import { IconLayers, IconGrid, IconSubject, IconShield, IconUsers, IconStudent, IconCash } from '../../layouts/sidebarIcons';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function squelette() {
  return (
    <div className="grid-4 mb-4">
      {[1, 2, 3, 4].map((i) => <div key={i} className="stat-card"><div className="spinner" style={{ margin: '12px auto' }} /></div>)}
    </div>
  );
}

export default function DashboardAdmin() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get('/admin/dashboard').then(({ data }) => setDonnees(data)).catch(() => setErreur('Impossible de charger le tableau de bord.'));
  }, []);

  if (erreur) return <div className="auth-erreur" role="alert">{erreur}</div>;
  if (!donnees) return (<><h1 className="page-titre">Tableau de bord — Administrateur</h1>{squelette()}</>);

  const graphique = {
    labels: donnees.classesParCycle.map((l) => l.cycle),
    datasets: [
      {
        label: 'Classes',
        data: donnees.classesParCycle.map((l) => l.classes),
        backgroundColor: '#1d4ed8',
        borderRadius: 6,
        maxBarThickness: 64,
      },
    ],
  };

  return (
    <>
      <h1 className="page-titre">Tableau de bord — Administrateur</h1>
      {donnees.anneeCourante && <p className="text-doux mb-4">Année académique courante : <strong>{donnees.anneeCourante}</strong></p>}

      <div className="grid-4 mb-4">
        <StatCard label="Cycles" valeur={donnees.cycles} tonalite=""><IconLayers /></StatCard>
        <StatCard label="Classes" valeur={donnees.classes} tonalite="jaune"><IconGrid /></StatCard>
        <StatCard label="Matières" valeur={donnees.matieres} tonalite="vert"><IconSubject /></StatCard>
        <StatCard label="Directeurs" valeur={donnees.directeurs} tonalite="rouge"><IconShield /></StatCard>
      </div>
      <div className="grid-4 mb-4">
        <StatCard label="Élèves" valeur={donnees.eleves} tonalite=""><IconStudent /></StatCard>
        <StatCard label="Professeurs" valeur={donnees.professeurs} tonalite="jaune"><IconUsers /></StatCard>
        <StatCard label="Parents" valeur={donnees.parents} tonalite="vert"><IconUsers /></StatCard>
        <StatCard label="Recouvrement" valeur={`${donnees.tauxRecouvrement} %`} tonalite="rouge"><IconCash /></StatCard>
      </div>

      <Card titre="Classes par cycle">
        <div style={{ maxWidth: 640 }}>
          <Bar
            data={graphique}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            }}
          />
        </div>
      </Card>
    </>
  );
}
