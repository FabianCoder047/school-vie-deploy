// Emploi du temps de l'enfant — lecture seule (vue semaine).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { useEnfants, EnfantSelect } from './useEnfants.jsx';
import Calendar from '../../components/Calendar';
import Card from '../../components/Card';

export default function EmploiDuTempsEnfantPage() {
  const { enfants, enfantId, setEnfantId, enfantSelectionne, chargement } = useEnfants();
  const [searchParams] = useSearchParams();
  const [creneaux, setCreneaux] = useState([]);
  const [erreur, setErreur] = useState('');
  const [chargementEdt, setChargementEdt] = useState(false);

  useEffect(() => {
    const id = Number(searchParams.get('enfant'));
    if (id && enfants.some((e) => e.enrollment_id === id)) setEnfantId(id);
  }, [searchParams, enfants, setEnfantId]);

  useEffect(() => {
    if (!enfantId) { setCreneaux([]); return; }
    setChargementEdt(true);
    setErreur('');
    api.get(`/parent/edt/${enfantId}`)
      .then(({ data }) => setCreneaux(data.creneaux || []))
      .catch(() => setErreur('Impossible de charger l’emploi du temps.'))
      .finally(() => setChargementEdt(false));
  }, [enfantId]);

  const evenements = creneaux.map((c) => ({
    id: c.id,
    jour: c.jour_semaine,
    heureDebut: String(c.heure_debut).slice(0, 5),
    heureFin: String(c.heure_fin).slice(0, 5),
    titre: `${c.matiere_nom} — ${c.prof_prenom} ${c.prof_nom}`,
    sousTitre: c.salle ? `Salle ${c.salle}` : '',
  }));

  if (chargement) return (<><h1 className="page-titre">Emploi du temps</h1><div className="spinner" /></>);
  if (enfants.length === 0) {
    return (<><h1 className="page-titre">Emploi du temps</h1><Card><p className="text-doux">Aucun enfant inscrit cette année.</p></Card></>);
  }

  return (
    <>
      <h1 className="page-titre">Emploi du temps</h1>
      <div className="flex-between mb-4">
        {enfantSelectionne && <span className="text-doux">{enfantSelectionne.classe_nom} · {enfantSelectionne.alias_nom} <BadgeGris>Lecture seule</BadgeGris></span>}
        <EnfantSelect enfants={enfants} enfantId={enfantId} onChange={setEnfantId} />
      </div>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}
      {chargementEdt ? <div className="spinner" /> : evenements.length === 0
        ? <Card><p className="text-doux">Aucun créneau planifié pour la classe de votre enfant.</p></Card>
        : <Calendar evenements={evenements} lectureSeule />}
    </>
  );
}

function BadgeGris({ children }) {
  return <span className="badge badge-gris" style={{ marginLeft: 8 }}>{children}</span>;
}
