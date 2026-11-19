// Communiqués — lecture seule (tous les rôles sauf publication).
// Affiche les communiqués qui concernent l'utilisateur : TOUS, ceux ciblant
// son rôle, et ceux ciblant un cycle / une classe / un alias où il enseigne
// (professeur) ou dont ses enfants sont inscrits (parent).
import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Card from '../../components/Card';
import Badge from '../../components/Badge';

const ROLES = [
  { value: 'ADMIN', label: 'Administrateurs' },
  { value: 'DIRECTEUR', label: 'Directeurs' },
  { value: 'SECRETAIRE', label: 'Secrétaires' },
  { value: 'COMPTABLE', label: 'Comptables' },
  { value: 'PROFESSEUR', label: 'Professeurs' },
  { value: 'PARENT', label: 'Parents' },
];

export default function CommuniquesLecture() {
  const [communiques, setCommuniques] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get('/communiques')
      .then(({ data }) => setCommuniques(data || []))
      .catch(() => setErreur('Impossible de charger les communiqués.'))
      .finally(() => setChargement(false));
  }, []);

  const libelleCibles = (c) => {
    const morceaux = [];
    for (const t of c.cibles || []) {
      if (t.target_type === 'TOUS') morceaux.push('Tous');
      else if (t.target_type === 'ROLE') morceaux.push(`Rôle : ${ROLES.find((r) => r.value === t.role)?.label || t.role}`);
      else if (t.target_type === 'CYCLE') morceaux.push(`Cycle : ${t.cycle_nom || t.cycle_id}`);
      else if (t.target_type === 'CLASSE') morceaux.push(`Classe : ${t.classe_nom || t.class_id}`);
      else if (t.target_type === 'ALIAS') morceaux.push(`Alias : ${t.alias_nom || t.class_alias_id}`);
    }
    return morceaux.join(' · ') || '—';
  };

  return (
    <>
      <h1 className="page-titre">Communiqués</h1>
      <p className="text-doux mb-4">Communiqués envoyés par l’école qui vous concernent.</p>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}
      {chargement ? (
        <div className="spinner" />
      ) : communiques.length === 0 ? (
        <Card><p className="text-doux">Aucun communiqué à votre intention pour l’instant.</p></Card>
      ) : (
        <div className="flex gap-4" style={{ flexDirection: 'column' }}>
          {communiques.map((c) => (
            <Card key={c.id}>
              <div className="flex-between gap-3" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <strong>{c.titre}</strong>
                <span className="text-doux" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <p className="mt-4" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{c.contenu}</p>
              <p className="mt-4" style={{ fontSize: 12 }}>
                <Badge couleur="bleu">{libelleCibles(c)}</Badge> — par {c.auteur_prenom} {c.auteur_nom}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
