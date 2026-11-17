// Notes de l'enfant — consultation en LECTURE SEULE.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { messageErreur } from '../../api/axios';
import { useEnfants, EnfantSelect } from './useEnfants.jsx';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Select from '../../components/Select';

export default function NotesPage() {
  const { enfants, enfantId, setEnfantId, enfantSelectionne, chargement } = useEnfants();
  const [searchParams] = useSearchParams();
  const [periodes, setPeriodes] = useState([]);
  const [periodeId, setPeriodeId] = useState('');
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargementFiche, setChargementFiche] = useState(false);

  // Pré-sélection via ?enfant=<id>
  useEffect(() => {
    const id = Number(searchParams.get('enfant'));
    if (id && enfants.some((e) => e.enrollment_id === id)) setEnfantId(id);
  }, [searchParams, enfants, setEnfantId]);

  useEffect(() => {
    api.get('/periodes').then(({ data }) => {
      const liste = data.periodes || [];
      setPeriodes(liste);
      if (liste.length > 0) setPeriodeId(String(liste[0].id));
    }).catch(() => setPeriodes([]));
  }, []);

  useEffect(() => {
    if (!enfantId || !periodeId) { setFiche(null); return; }
    setChargementFiche(true);
    setErreur('');
    api.get(`/parent/notes/${enfantId}?evaluation_period_id=${periodeId}`)
      .then(({ data }) => setFiche(data))
      .catch((err) => setErreur(messageErreur(err, 'Impossible de charger les notes.')))
      .finally(() => setChargementFiche(false));
  }, [enfantId, periodeId]);

  if (chargement) return (<><h1 className="page-titre">Notes & bulletins</h1><div className="spinner" /></>);
  if (enfants.length === 0) {
    return (<><h1 className="page-titre">Notes & bulletins</h1><Card><p className="text-doux">Aucun enfant inscrit cette année.</p></Card></>);
  }

  return (
    <>
      <h1 className="page-titre">Notes & bulletins</h1>
      <div className="flex-between mb-4"><span /><EnfantSelect enfants={enfants} enfantId={enfantId} onChange={setEnfantId} /></div>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      <Card className="mb-4">
        <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          {enfantSelectionne && (
            <>
              <div>
                <div style={{ fontSize: 12, color: 'var(--texte-doux)', textTransform: 'uppercase', fontWeight: 700 }}>Élève</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{enfantSelectionne.prenom} {enfantSelectionne.nom}</div>
                <div className="text-doux" style={{ fontSize: 12 }}>{enfantSelectionne.matricule} — {enfantSelectionne.classe_nom} · {enfantSelectionne.alias_nom}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Select label="Période" name="periode" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)} style={{ minWidth: 180 }}>
                  {periodes.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
                </Select>
              </div>
            </>
          )}
        </div>
      </Card>

      {chargementFiche || !fiche ? (
        <div className="spinner" />
      ) : (
        <>
          {/* ===== Synthèse ===== */}
          <div className="grid-4 mb-4">
            <div className="stat-card">
              <div><div className="stat-card-label">Moyenne générale</div><div className="stat-card-valeur">{fiche.moyenneGenerale !== null ? fiche.moyenneGenerale.toFixed(2) : '—'}</div><div className="stat-card-detail">{fiche.appreciation || ''}</div></div>
            </div>
            <div className="stat-card">
              <div><div className="stat-card-label">Rang</div><div className="stat-card-valeur">{fiche.rang ?? '—'}<span style={{ fontSize: 13, color: 'var(--texte-doux)' }}> / {fiche.effectif}</span></div><div className="stat-card-detail">Moyenne classe : {fiche.moyenneClasse?.toFixed(2) ?? '—'}</div></div>
            </div>
            <div className="stat-card">
              <div><div className="stat-card-label">Absences</div><div className="stat-card-valeur">{fiche.absences}</div><div className="stat-card-detail">séance{fiche.absences > 1 ? 's' : ''}</div></div>
            </div>
            <div className="stat-card">
              <div><div className="stat-card-label">Retards</div><div className="stat-card-valeur">{fiche.retards}</div><div className="stat-card-detail">{fiche.retardMinutes} min au total</div></div>
            </div>
          </div>

          {/* ===== Notes par matière ===== */}
          <div className="table-conteneur">
            <table className="tableau" style={{ minWidth: 560 }}>
              <thead>
                <tr><th>Matière</th><th>Coef</th><th>Interro</th><th>Devoir</th><th>Compo</th><th>Moyenne</th></tr>
              </thead>
              <tbody>
                {fiche.matieres.map((m) => (
                  <tr key={m.class_subject_id}>
                    <td><strong>{m.matiere}</strong></td>
                    <td>{m.coefficient}</td>
                    <td>{m.interro?.toFixed(2) ?? '—'}</td>
                    <td>{m.devoir?.toFixed(2) ?? '—'}</td>
                    <td>{m.compo?.toFixed(2) ?? '—'}</td>
                    <td style={{ fontWeight: 800, color: m.moyenne == null ? 'var(--gris-400)' : m.moyenne >= 10 ? 'var(--vert-700)' : 'var(--rouge-700)' }}>
                      {m.moyenne?.toFixed(2) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
