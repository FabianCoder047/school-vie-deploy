// Absences de mes élèves — tableau par période (les alias du professeur),
// avec détail complet par élève (justifiée / non justifiée + motifs).
import { useEffect, useMemo, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Select from '../../components/Select';
import SearchBar from '../../components/SearchBar';
import AbsencesEleveModal from '../../components/AbsencesEleveModal';

export default function AbsencesElevesPage() {
  const [periodeId, setPeriodeId] = useState(''); // '' = toute l'année
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [fiche, setFiche] = useState(null); // { enrollment_id, nom, prenom }
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    setChargement(true);
    const params = new URLSearchParams();
    if (periodeId) params.set('evaluation_period_id', periodeId);
    api.get(`/professeur/eleves-absences?${params.toString()}`)
      .then(({ data }) => { setDonnees(data); setErreur(''); })
      .catch((err) => setErreur(messageErreur(err, 'Chargement impossible.')))
      .finally(() => setChargement(false));
  }, [periodeId]);

  const elevesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = donnees?.eleves || [];
    if (!q) return liste;
    return liste.filter((e) => `${e.nom} ${e.prenom} ${e.matricule} ${e.alias_nom}`.toLowerCase().includes(q));
  }, [donnees, recherche]);

  return (
    <>
      <h1 className="page-titre">Absences de mes élèves</h1>
      <p className="text-doux mb-4">Compteurs d’absences et de retards pour les élèves de vos classes. « Détail » ouvre l’historique complet avec les motifs de justification.</p>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      <Card className="mb-4">
        <div className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Select label="Période" name="periode" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">Toute l’année</option>
            {(donnees?.periodes || []).map((p) => <option key={p.id} value={String(p.id)}>{p.libelle}</option>)}
          </Select>
          <div style={{ marginLeft: 'auto' }}>
            <SearchBar valeur={recherche} onChange={setRecherche} placeholder="Rechercher un élève…" />
          </div>
        </div>
      </Card>

      {chargement && !donnees ? (
        <div className="spinner" />
      ) : !donnees || elevesFiltres.length === 0 ? (
        <Card><p className="text-doux">{recherche ? 'Aucun élève ne correspond à la recherche.' : 'Aucun élève dans vos classes pour l’instant.'}</p></Card>
      ) : (
        <div className="table-conteneur">
          <table className="tableau" style={{ minWidth: 760 }}>
            <thead>
              <tr><th>Élève</th><th>Alias</th><th>Absences</th><th>Justif.</th><th>Non just.</th><th>Retards</th><th style={{ width: 90 }}>Détail</th></tr>
            </thead>
            <tbody>
              {elevesFiltres.map((e) => (
                <tr key={e.enrollment_id}>
                  <td><strong>{e.nom}</strong> {e.prenom}<div className="text-doux" style={{ fontSize: 11 }}>{e.matricule}</div></td>
                  <td>{e.classe_nom} · {e.alias_nom}</td>
                  <td>{e.absences === 0 ? e.absences : <Badge couleur="rouge">{e.absences}</Badge>}</td>
                  <td>{e.justifiees}</td>
                  <td>{e.nonJustifiees}</td>
                  <td>{e.retards}{e.retardMinutes > 0 ? ` (${e.retardMinutes} min)` : ''}</td>
                  <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setFiche(e)}>Détail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fiche && (
        <AbsencesEleveModal
          endpoint={`/professeur/eleve/${fiche.enrollment_id}/absences`}
          titre={`Absences — ${fiche.prenom} ${fiche.nom}`}
          onFermer={() => setFiche(null)}
        />
      )}
    </>
  );
}
