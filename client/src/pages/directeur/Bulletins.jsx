// Bulletins — aperçu avant impression (PDF à la volée, une page par élève).
// Par alias, ou par cycle entier pour une période donnée.
import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Select from '../../components/Select';
import ApercuPdf from '../../components/ApercuPdf';

export default function BulletinsPage() {
  const [cycles, setCycles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [periodeId, setPeriodeId] = useState('');

  const [classeId, setClasseId] = useState('');
  const [aliasId, setAliasId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [erreur, setErreur] = useState('');
  const [apercu, setApercu] = useState(null); // { url, titre }

  useEffect(() => {
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
    api.get('/classes/toutes').then(({ data }) => setClasses(data || [])).catch(() => setClasses([]));
    api.get('/periodes').then(({ data }) => {
      setPeriodes(data.periodes || []);
      if (data.periodes?.length > 0) setPeriodeId(String(data.periodes[0].id));
    }).catch(() => setPeriodes([]));
  }, []);

  useEffect(() => {
    setAliases([]);
    setAliasId('');
    if (!classeId) return;
    api.get(`/alias/classe/${classeId}`).then(({ data }) => setAliases(data || [])).catch(() => setAliases([]));
  }, [classeId]);

  const apercuAlias = () => {
    setErreur('');
    if (!aliasId || !periodeId) { setErreur('Choisissez un alias et une période.'); return; }
    const alias = aliases.find((a) => String(a.id) === String(aliasId));
    const periode = periodes.find((p) => String(p.id) === String(periodeId));
    setApercu({ url: `/directeur/bulletins/alias/${aliasId}?evaluation_period_id=${periodeId}`, titre: `Bulletins — ${alias?.nom || 'classe'} · ${periode?.libelle || ''}` });
  };

  const apercuCycle = () => {
    setErreur('');
    if (!cycleId || !periodeId) { setErreur('Choisissez un cycle et une période.'); return; }
    const cycle = cycles.find((c) => String(c.id) === String(cycleId));
    const periode = periodes.find((p) => String(p.id) === String(periodeId));
    setApercu({ url: `/directeur/bulletins/cycle/${cycleId}?evaluation_period_id=${periodeId}`, titre: `Bulletins — Cycle ${cycle?.nom || ''} · ${periode?.libelle || ''}` });
  };

  return (
    <>
      <h1 className="page-titre">Bulletins</h1>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      <Card titre="Période" className="mb-4">
        <Select label="Période d’évaluation" name="periode" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
          <option value="">— Choisir une période —</option>
          {periodes.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
        </Select>
      </Card>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card titre="Par alias (classe)">
          <p className="text-doux">Un PDF avec <strong>une page par élève</strong> de l’alias : matières, moyennes, rang, moyenne de la classe, absences/retards.</p>
          <Select label="Classe" name="classe" value={classeId} onChange={(e) => setClasseId(e.target.value)} className="mt-4">
            <option value="">— Choisir une classe —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.cycle_nom} · {c.nom}</option>)}
          </Select>
          <Select label="Alias" name="alias" value={aliasId} onChange={(e) => setAliasId(e.target.value)} disabled={!classeId} className="mt-4">
            <option value="">— Choisir un alias —</option>
            {aliases.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </Select>
          <Button className="mt-4" onClick={apercuAlias} disabled={!aliasId || !periodeId}>
            Aperçu / Imprimer (PDF)
          </Button>
        </Card>

        <Card titre="Par cycle entier">
          <p className="text-doux">Un PDF unique avec les bulletins de tous les élèves du cycle choisi (par ordre de classe).</p>
          <Select label="Cycle" name="cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)} className="mt-4">
            <option value="">— Choisir un cycle —</option>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Select>
          <Button className="mt-4" variant="secondary" onClick={apercuCycle} disabled={!cycleId || !periodeId}>
            Aperçu / Imprimer (PDF)
          </Button>
        </Card>
      </div>

      <Card titre="Contenu du bulletin" className="mt-4">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--gris-600)', fontSize: 13, lineHeight: 1.9 }}>
          <li>Notes par matière : Interro, Devoir, Compo (sur 20) + moyenne de chaque matière (pondérée par le coefficient)</li>
          <li>Moyenne générale (pondérée), <strong>rang</strong> dans la classe, moyenne de la classe</li>
          <li>Appréciation générale automatique selon la moyenne</li>
          <li>Assiduité : absences et retards (avec minutes) de la période</li>
          <li>Filigrane, en-tête de l’établissement, signature et cachet du Directeur</li>
        </ul>
      </Card>

      {/* Aperçu dans l'application */}
      {apercu && <ApercuPdf titre={apercu.titre} url={apercu.url} onFermer={() => setApercu(null)} />}
    </>
  );
}
