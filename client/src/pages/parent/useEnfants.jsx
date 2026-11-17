// Hook partagé de l'espace Parent : charge les enfants du parent
// et gère la sélection courante.
import { useEffect, useState } from 'react';
import api from '../../api/axios';

export function useEnfants() {
  const [enfants, setEnfants] = useState([]);
  const [annee, setAnnee] = useState(null);
  const [enfantId, setEnfantId] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api.get('/parent/mes-enfants')
      .then(({ data }) => {
        setAnnee(data.annee);
        setEnfants(data.enfants || []);
        if (data.enfants?.length > 0) setEnfantId(data.enfants[0].enrollment_id);
      })
      .catch(() => setEnfants([]))
      .finally(() => setChargement(false));
  }, []);

  const enfantSelectionne = enfants.find((e) => e.enrollment_id === enfantId) || null;
  return { enfants, annee, enfantId, setEnfantId, enfantSelectionne, chargement };
}

export function EnfantSelect({ enfants, enfantId, onChange }) {
  if (enfants.length <= 1) return null;
  return (
    <div className="flex gap-2" style={{ alignItems: 'center', marginLeft: 'auto' }}>
      <span className="text-doux" style={{ fontSize: 13 }}>Enfant :</span>
      <select className="select-filtre" style={{ width: 'auto', minWidth: 240 }} value={enfantId || ''} onChange={(e) => onChange(Number(e.target.value))} aria-label="Choisir un enfant">
        {enfants.map((e) => <option key={e.enrollment_id} value={e.enrollment_id}>{e.prenom} {e.nom} — {e.classe_nom} {e.alias_nom}</option>)}
      </select>
    </div>
  );
}

export function photoUrlEleve(url) {
  if (!url) return null;
  const origine = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return url.startsWith('http') ? url : `${origine}${url}`;
}
