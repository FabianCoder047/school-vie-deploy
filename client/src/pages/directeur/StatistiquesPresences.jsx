// Statistiques de présences (Directeur / Secrétaire) — même écran, le
// rôle décide de l'accès au détail par élève (prop peutVoirDetail).
import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import api, { messageErreur } from '../../api/axios';
import Card from '../../components/Card';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import Select from '../../components/Select';
import Button from '../../components/Button';
import AbsencesEleveModal from '../../components/AbsencesEleveModal';
import SearchBar from '../../components/SearchBar';
import { IconAlert, IconClock, IconChart, IconNote } from '../../layouts/sidebarIcons';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function StatistiquesPresences({ base = '/directeur', peutVoirDetail = false }) {
  const [periodeId, setPeriodeId] = useState(''); // '' = période courante · 'all' = toute l'année
  const [aliasId, setAliasId] = useState('');
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [fiche, setFiche] = useState(null); // { id, nom, prenom }
  const [recherche, setRecherche] = useState('');
  const [aliasesConnus, setAliasesConnus] = useState([]);

  useEffect(() => {
    setChargement(true);
    const params = new URLSearchParams();
    if (periodeId) params.set('evaluation_period_id', periodeId);
    if (aliasId) params.set('alias_id', aliasId);
    api.get(`${base}/statistiques-presences?${params.toString()}`)
      .then(({ data }) => {
        setDonnees(data);
        setErreur('');
        setAliasesConnus((precedent) => {
          const map = new Map(precedent.map((a) => [a.class_alias_id, a]));
          for (const a of data.parAlias || []) map.set(a.class_alias_id, a);
          return [...map.values()].sort((x, y) => `${x.classe_nom} ${x.alias_nom}`.localeCompare(`${y.classe_nom} ${y.alias_nom}`));
        });
      })
      .catch((err) => setErreur(messageErreur(err, 'Chargement des statistiques impossible.')))
      .finally(() => setChargement(false));
  }, [base, periodeId, aliasId]);

  const parAliasTries = useMemo(
    () => [...(donnees?.parAlias || [])].sort((a, b) => b.absences - a.absences || b.retards - a.retards),
    [donnees]
  );
  const parEleveFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = donnees?.parEleve || [];
    if (!q) return liste;
    return liste.filter((e) => `${e.nom} ${e.prenom} ${e.matricule} ${e.alias_nom}`.toLowerCase().includes(q));
  }, [donnees, recherche]);

  const totaux = donnees?.totaux;
  const graphiquePeriodes = donnees ? {
    labels: donnees.parPeriode.map((p) => p.libelle),
    datasets: [
      { label: 'Justifiées', data: donnees.parPeriode.map((p) => p.justifiees), backgroundColor: '#16a34a', borderRadius: 4 },
      { label: 'Non justifiées', data: donnees.parPeriode.map((p) => p.nonJustifiees), backgroundColor: '#dc2626', borderRadius: 4 },
    ],
  } : null;
  const graphiqueMotif = totaux && totaux.absences > 0 ? {
    labels: ['Justifiées', 'Non justifiées'],
    datasets: [{ data: [totaux.justifiees, totaux.nonJustifiees], backgroundColor: ['#16a34a', '#dc2626'], borderWidth: 0 }],
  } : null;

  const intitulePeriode = periodeId === 'all'
    ? 'Toute l’année'
    : donnees?.periode?.libelle || 'Période courante';

  return (
    <>
      <h1 className="page-titre">Statistiques de présences</h1>
      <p className="text-doux mb-4">Absences et retards {intitulePeriode.toLowerCase() === 'toute l’année' ? 'sur toute l’année scolaire' : `— ${intitulePeriode}`}. Une absence est « justifiée » lorsque le parent envoie un motif ou que le professeur la marque comme telle.</p>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      {/* ===== Filtres ===== */}
      <Card className="mb-4">
        <div className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Select label="Période" name="periode" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">Période courante</option>
            {(donnees?.periodes || []).map((p) => <option key={p.id} value={String(p.id)}>{p.libelle}</option>)}
            <option value="all">Toute l’année</option>
          </Select>
          <Select label="Classe / alias" name="alias" value={aliasId} onChange={(e) => setAliasId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">Toutes les classes</option>
            {aliasesConnus.map((a) => <option key={a.class_alias_id} value={String(a.class_alias_id)}>{a.classe_nom} · {a.alias_nom}</option>)}
          </Select>
          {(periodeId || aliasId) && (
            <Button variant="secondary" size="sm" onClick={() => { setPeriodeId(''); setAliasId(''); }}>Réinitialiser les filtres</Button>
          )}
        </div>
      </Card>

      {chargement && !donnees ? (
        <div className="spinner" />
      ) : totaux ? (
        <>
          {/* ===== KPI ===== */}
          <div className="grid-4 mb-4">
            <StatCard label="Absences" valeur={totaux.absences} detail={`${totaux.justifiees} justifiées · ${totaux.nonJustifiees} non justifiées`} tonalite="rouge"><IconAlert /></StatCard>
            <StatCard label="Retards" valeur={totaux.retards} detail={`${totaux.retardMinutes} minute${totaux.retardMinutes > 1 ? 's' : ''} au total`} tonalite="jaune"><IconClock /></StatCard>
            <StatCard label="% justifiées" valeur={`${String(totaux.tauxJustification).replace('.', ',')} %`} detail={`${totaux.justifiees} sur ${totaux.absences} absence${totaux.absences > 1 ? 's' : ''}`} tonalite="vert"><IconNote /></StatCard>
            <StatCard label="Taux d’absence" valeur={`${String(totaux.tauxAbsence).replace('.', ',')} %`} detail="absences / (effectif × séances)" tonalite=""><IconChart /></StatCard>
          </div>

          {/* ===== Graphiques ===== */}
          <div className="grid-2 mb-4" style={{ alignItems: 'stretch' }}>
            <Card titre="Évolution par période (justifiées / non)">
              {graphiquePeriodes && donnees.parPeriode.some((p) => p.absences > 0) ? (
                <Bar data={graphiquePeriodes} options={{ responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } }} />
              ) : (
                <p className="text-doux">Aucune absence saisie sur l’année.</p>
              )}
            </Card>
            <Card titre="Motifs — période affichée">
              {graphiqueMotif ? (
                <div style={{ maxWidth: 260, margin: '0 auto' }}>
                  <Doughnut data={graphiqueMotif} options={{ plugins: { legend: { position: 'bottom' } } }} />
                </div>
              ) : (
                <p className="text-doux">Aucune absence sur la période affichée.</p>
              )}
            </Card>
          </div>

          {/* ===== Par alias ===== */}
          <h2 className="card-titre">Par classe / alias</h2>
          {parAliasTries.length === 0 ? (
            <Card className="mb-4"><p className="text-doux">Aucune classe avec des élèves cette année.</p></Card>
          ) : (
            <div className="table-conteneur mb-4">
              <table className="tableau" style={{ minWidth: 860 }}>
                <thead>
                  <tr><th>Alias</th><th>Classe</th><th>Effectif</th><th>Séances</th><th>Absences</th><th>Justif.</th><th>Non just.</th><th>Retards</th><th>Taux abs.</th><th style={{ width: 90 }}>Action</th></tr>
                </thead>
                <tbody>
                  {parAliasTries.map((a) => (
                    <tr key={a.class_alias_id}>
                      <td><strong>{a.alias_nom}</strong></td>
                      <td>{a.classe_nom}</td>
                      <td>{a.effectif}</td>
                      <td>{a.seances}</td>
                      <td style={{ fontWeight: 800 }}>{a.absences}</td>
                      <td>{a.justifiees}</td>
                      <td>{a.nonJustifiees}</td>
                      <td>{a.retards}</td>
                      <td>{String(a.tauxAbsence).replace('.', ',')} %</td>
                      <td>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAliasId(String(a.class_alias_id))}>Filtrer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ===== Élèves avec absences/retards ===== */}
          <div className="flex-between mb-2" style={{ gap: 12, flexWrap: 'wrap' }}>
            <h2 className="card-titre" style={{ margin: 0 }}>Élèves avec absences ou retards</h2>
            <SearchBar valeur={recherche} onChange={setRecherche} placeholder="Rechercher un élève…" />
          </div>
          {parEleveFiltres.length === 0 ? (
            <Card><p className="text-doux">{recherche ? 'Aucun élève ne correspond à la recherche.' : 'Aucune absence ni retard sur la période affichée.'}</p></Card>
          ) : (
            <div className="table-conteneur mb-4">
              <table className="tableau" style={{ minWidth: 760 }}>
                <thead>
                  <tr><th>Élève</th><th>Alias</th><th>Absences</th><th>Justif.</th><th>Non just.</th><th>Retards</th>{peutVoirDetail && <th style={{ width: 90 }}>Détail</th>}</tr>
                </thead>
                <tbody>
                  {parEleveFiltres.map((e) => (
                    <tr key={e.enrollment_id}>
                      <td><strong>{e.nom}</strong> {e.prenom}<div className="text-doux" style={{ fontSize: 11 }}>{e.matricule}</div></td>
                      <td>{e.classe_nom} · {e.alias_nom}</td>
                      <td style={{ fontWeight: 800 }}>{e.absences}</td>
                      <td>{e.justifiees}</td>
                      <td>{e.nonJustifiees}</td>
                      <td>{e.retards}</td>
                      {peutVoirDetail && (
                        <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setFiche(e)}>Détail</button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <Card><p className="text-doux">Aucune donnée disponible pour l’instant.</p></Card>
      )}

      {fiche && peutVoirDetail && (
        <AbsencesEleveModal
          endpoint={`/directeur/eleve/${fiche.enrollment_id}/absences`}
          titre={`Absences — ${fiche.prenom} ${fiche.nom}`}
          onFermer={() => setFiche(null)}
        />
      )}
    </>
  );
}
