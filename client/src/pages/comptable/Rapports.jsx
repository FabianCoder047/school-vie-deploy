// Rapports comptables par cycle et par classe + export PDF à la volée.
import { useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import SelectFiltre from '../../components/SelectFiltre';
import ApercuPdf from '../../components/ApercuPdf';

export default function RapportsPage() {
  const [rapport, setRapport] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [cycleFiltre, setCycleFiltre] = useState('');
  const [cycles, setCycles] = useState([]);
  const [erreur, setErreur] = useState('');
  const [apercuPdf, setApercuPdf] = useState(null); // { url, titre }

  const fmt = (n) => `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`;

  const chargerCycles = () => {
    if (cycles.length) return;
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
  };

  const generer = async () => {
    chargerCycles();
    setChargement(true);
    setErreur('');
    try {
      const params = new URLSearchParams();
      if (cycleFiltre) params.set('cycle_id', cycleFiltre);
      const { data } = await api.get(`/comptable/rapports?${params.toString()}`);
      setRapport(data);
    } catch (err) {
      setErreur(messageErreur(err, 'Génération impossible.'));
    } finally {
      setChargement(false);
    }
  };

  const exporterPdf = () => {
    const params = new URLSearchParams();
    if (cycleFiltre) params.set('cycle_id', cycleFiltre);
    setApercuPdf({ url: `/comptable/rapports/pdf?${params.toString()}`, titre: 'Rapport comptable' });
  };

  return (
    <>
      <h1 className="page-titre">Rapports comptables</h1>
      <Card>
        <div className="flex-between gap-3" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <p className="text-doux">Attendu / encaissé / reste à payer / taux de recouvrement, par cycle et par classe (année courante).</p>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <SelectFiltre label="Cycle" value={cycleFiltre} onFocus={chargerCycles} onChange={(e) => setCycleFiltre(e.target.value)}>
              <option value="">Tous les cycles</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </SelectFiltre>
            <Button onClick={generer} disabled={chargement}>{chargement ? 'Génération…' : 'Générer le rapport'}</Button>
            {rapport && <Button variant="secondary" onClick={exporterPdf}>Aperçu du rapport (PDF)</Button>}
          </div>
        </div>
        {erreur && <div className="auth-erreur mt-4" role="alert">{erreur}</div>}
      </Card>

      {rapport && (
        <>
          {rapport.cycles.map((cycle) => (
            <Card key={cycle.cycle_id} titre={`Cycle ${cycle.cycle_nom}`} className="mt-4">
              <div className="table-conteneur">
                <table className="tableau" style={{ minWidth: 720 }}>
                  <thead>
                    <tr><th>Classe</th><th>Effectif</th><th>Attendu</th><th>Encaissé</th><th>Reste</th><th>Recouvrement</th></tr>
                  </thead>
                  <tbody>
                    {cycle.classes.map((c) => (
                      <tr key={c.class_id}>
                        <td><strong>{c.classe_nom}</strong></td>
                        <td>{c.effectif}</td>
                        <td>{fmt(c.attendu)}</td>
                        <td>{fmt(c.encaisse)}</td>
                        <td>{fmt(c.reste)}</td>
                        <td><Badge couleur={c.taux >= 80 ? 'vert' : c.taux >= 50 ? 'jaune' : 'rouge'}>{c.taux} %</Badge></td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--bleu-50)', fontWeight: 700 }}>
                      <td>Sous-total {cycle.cycle_nom}</td>
                      <td>{cycle.effectif}</td>
                      <td>{fmt(cycle.attendu)}</td>
                      <td>{fmt(cycle.encaisse)}</td>
                      <td>{fmt(cycle.reste)}</td>
                      <td>{cycle.taux} %</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

          <Card titre="Total école" className="mt-4">
            <div className="grid-4">
              <div><div className="stat-card-label">Élèves</div><div className="stat-card-valeur">{rapport.total.effectif}</div></div>
              <div><div className="stat-card-label">Attendu</div><div className="stat-card-valeur" style={{ fontSize: 19 }}>{fmt(rapport.total.attendu)}</div></div>
              <div><div className="stat-card-label">Encaissé</div><div className="stat-card-valeur" style={{ fontSize: 19 }}>{fmt(rapport.total.encaisse)}</div></div>
              <div><div className="stat-card-label">Recouvrement</div><div className="stat-card-valeur">{rapport.total.taux} %</div></div>
            </div>
          </Card>
        </>
      )}
      {/* Aperçu du rapport dans l'application */}
      {apercuPdf && <ApercuPdf titre={apercuPdf.titre} url={apercuPdf.url} onFermer={() => setApercuPdf(null)} />}
    </>
  );
}
