// Emploi du temps personnel du professeur (lecture seule) — vue semaine.
import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Calendar from '../../components/Calendar';
import Card from '../../components/Card';
import Badge from '../../components/Badge';

export default function MonEmploiDuTempsPage() {
  const [creneaux, setCreneaux] = useState([]);
  const [annee, setAnnee] = useState(null);
  const [config, setConfig] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    Promise.all([api.get('/professeur/mon-edt'), api.get('/edt-config')])
      .then(([edt, cfg]) => { setAnnee(edt.data.annee); setCreneaux(edt.data.creneaux || []); setConfig(cfg.data); })
      .catch(() => setErreur('Impossible de charger votre emploi du temps.'))
      .finally(() => setChargement(false));
  }, []);

  const estPrimaire = creneaux.length > 0
    && creneaux.every((c) => String(c.cycle_nom || '').toLowerCase().includes('primaire'));

  const evenements = creneaux.map((c) => ({
    id: c.id,
    jour: c.jour_semaine,
    heureDebut: String(c.heure_debut).slice(0, 5),
    heureFin: String(c.heure_fin).slice(0, 5),
    titre: `${c.matiere_nom} — ${c.alias_nom}`,
    sousTitre: c.salle ? `Salle ${c.salle}` : (c.classe_nom || ''),
  }));

  if (chargement) return (<><h1 className="page-titre">Mon emploi du temps</h1><div className="spinner" /></>);

  return (
    <>
      <h1 className="page-titre">Mon emploi du temps</h1>
      {annee && <p className="text-doux mb-4">Année académique courante : <strong>{annee.libelle}</strong>{' '}<Badge couleur="gris">Lecture seule</Badge></p>}
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}
      {evenements.length === 0
        ? <Card><p className="text-doux">Aucun créneau planifié pour vous cette année.</p></Card>
        : <Calendar evenements={evenements} lectureSeule config={config} estPrimaire={estPrimaire} />}
    </>
  );
}
