// Tableau de bord Professeur : KPI réels, ses classes/matières,
// moyennes par classe (graphique), prochain cours.
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { IconGrid, IconSubject, IconStudent, IconClock, IconAlert } from '../../layouts/sidebarIcons';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function DashboardProfesseur() {
  const [donnees, setDonnees] = useState(null);
  const [mesClasses, setMesClasses] = useState({ classes: [], annee: null });
  const [erreur, setErreur] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get('/professeur/dashboard'), api.get('/professeur/mes-classes')])
      .then(([d, m]) => { setDonnees(d.data); setMesClasses(m.data); })
      .catch(() => setErreur('Impossible de charger le tableau de bord.'));
  }, []);

  if (erreur) return <div className="auth-erreur" role="alert">{erreur}</div>;
  if (!donnees) {
    return (
      <>
        <h1 className="page-titre">Tableau de bord — Professeur</h1>
        <div className="grid-4 mb-4">{[1, 2, 3, 4].map((i) => <div key={i} className="stat-card"><div className="spinner" style={{ margin: '12px auto' }} /></div>)}</div>
      </>
    );
  }

  const parAlias = new Map();
  for (const c of mesClasses.classes) {
    const cle = c.alias_id;
    if (!parAlias.has(cle)) parAlias.set(cle, { aliasId: c.alias_id, alias: c.alias_nom, classe: c.classe_nom, cycle: c.cycle_nom, effectif: c.effectif, matieres: [] });
    parAlias.get(cle).matieres.push(c.matiere_nom);
  }
  const aliases = [...parAlias.values()];

  const moyennes = donnees.moyennesParClasse || [];
  const graphique = moyennes.length > 0 ? {
    labels: moyennes.map((m) => `${m.alias}`),
    datasets: [{
      label: 'Moyenne',
      data: moyennes.map((m) => m.moyenne),
      backgroundColor: '#1d4ed8',
      borderRadius: 6,
      maxBarThickness: 56,
    }],
  } : null;

  return (
    <>
      <h1 className="page-titre">Tableau de bord — Professeur</h1>
      {donnees.anneeCourante && <p className="text-doux mb-4">Année académique courante : <strong>{donnees.anneeCourante}</strong></p>}

      <div className="grid-4 mb-4">
        <StatCard label="Classes" valeur={donnees.nbClasses} tonalite=""><IconGrid /></StatCard>
        <StatCard label="Matières" valeur={donnees.nbMatieres} tonalite="jaune"><IconSubject /></StatCard>
        <StatCard label="Élèves" valeur={donnees.nbEleves} tonalite="vert"><IconStudent /></StatCard>
        <StatCard label="Absences (mois)" valeur={donnees.absencesMois ?? 0} tonalite="rouge"><IconAlert /></StatCard>
        <StatCard
          label="Prochain cours"
          valeur={donnees.prochainCours ? `${String(donnees.prochainCours.heure_debut).slice(0, 5)}` : '—'}
          detail={donnees.prochainCours ? `${donnees.prochainCours.matiere_nom} · ${donnees.prochainCours.alias_nom}` : 'Aucun cours aujourd’hui'}
          tonalite="rouge"
        >
          <IconClock />
        </StatCard>
      </div>

      {/* === Mes classes === */}
      <h2 className="card-titre" style={{ marginTop: 0 }}>Mes classes et matières</h2>
      <div className="grid-3 mb-4">
        {aliases.map((a) => (
          <Card key={a.aliasId} className="" >
            <div className="flex-between">
              <div>
                <div className="stat-card-label">{a.cycle}</div>
                <div style={{ fontSize: 19, fontWeight: 800 }}>{a.classe} · {a.alias}</div>
              </div>
              <Badge couleur="bleu">{a.effectif} élève{a.effectif > 1 ? 's' : ''}</Badge>
            </div>
            <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
              {a.matieres.map((m) => <Badge key={m} couleur="gris">{m}</Badge>)}
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => navigate(`/professeur/notes?alias=${a.aliasId}`)}>Saisir les notes</Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/professeur/appel')}>Faire l’appel</Button>
            </div>
          </Card>
        ))}
      </div>

      {/* === Moyennes par classe === */}
      {graphique && (
        <Card titre="Moyennes par classe (toutes périodes)">
          <div style={{ maxWidth: 560 }}>
            <Bar data={graphique} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 20 } } }} />
          </div>
        </Card>
      )}
      {!graphique && mesClasses.classes.length > 0 && (
        <Card titre="Moyennes par classe">
          <p className="text-doux">Aucune note saisie pour l’instant.</p>
        </Card>
      )}
    </>
  );
}
