// Fiches de proclamation — aperçu avant impression (PDF à la volée, une fiche
// par alias) : élèves classés par rang, moyenne générale et décision.
// Partagé Directeur / Secrétaire ; côté Secrétaire, le directeur doit avoir donné le feu vert.
import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Select from '../../components/Select';
import ApercuPdf from '../../components/ApercuPdf';
import FeuVertImpression from '../../components/FeuVertImpression';

export default function ProclamationsEspace({ espace = 'directeur' }) {
  const apiBase = espace === 'directeur' ? '/directeur' : '/secretaire';
  const estDirecteur = espace === 'directeur';
  const colonne = 'proclamations_impression_autorisee';
  const type = 'proclamations';

  const [autorisation, setAutorisation] = useState(estDirecteur ? true : null);
  useEffect(() => {
    let actif = true;
    api.get('/parametres').then(({ data }) => { if (actif) setAutorisation(Boolean(data?.[colonne])); }).catch(() => { if (actif) setAutorisation(false); });
    const onChange = (e) => { if (e.detail?.type === type) setAutorisation(Boolean(e.detail.autorisee)); };
    window.addEventListener('feu-vert-change', onChange);
    // Resynchro périodique (le feu vert est levé/révoqué sur l'écran du directeur)
    const minuteur = window.setInterval(() => {
      api.get('/parametres').then(({ data }) => { if (actif) setAutorisation(Boolean(data?.[colonne])); }).catch(() => {});
    }, 30000);
    return () => { actif = false; window.removeEventListener('feu-vert-change', onChange); window.clearInterval(minuteur); };
  }, [colonne]);
  const peutImprimer = estDirecteur || autorisation === true;

  const [classes, setClasses] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [periodeId, setPeriodeId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [aliasId, setAliasId] = useState('');
  const [erreur, setErreur] = useState('');
  const [apercu, setApercu] = useState(null); // { url, titre }

  useEffect(() => {
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

  const apercuFiche = () => {
    setErreur('');
    if (!aliasId || !periodeId) { setErreur('Choisissez un alias et une période.'); return; }
    const alias = aliases.find((a) => String(a.id) === String(aliasId));
    const periode = periodes.find((p) => String(p.id) === String(periodeId));
    setApercu({
      url: `${apiBase}/proclamations/alias/${aliasId}?evaluation_period_id=${periodeId}`,
      titre: `Fiche de proclamation — ${alias?.nom || 'alias'} · ${periode?.libelle || ''}`,
    });
  };

  return (
    <>
      <h1 className="page-titre">Fiches de proclamation</h1>
      {estDirecteur && <FeuVertImpression type={type} />}
      {!estDirecteur && autorisation === false && (
        <div className="auth-erreur mb-4" role="alert">Le directeur n’a pas encore donné le feu vert pour l’impression des fiches de proclamation. Les boutons sont désactivés ; vous les retrouverez dès son autorisation.</div>
      )}
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      <Card titre="Période" className="mb-4">
        <Select label="Période d’évaluation" name="periode" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
          <option value="">— Choisir une période —</option>
          {periodes.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
        </Select>
      </Card>

      <Card titre="Fiche par alias">
        <p className="text-doux">
          Un PDF avec <strong>une fiche A4 pour l’alias choisi</strong> : les élèves classés par rang
          (1er, 2ème…), leur moyenne générale et la décision (<strong>Admis</strong> si moyenne ≥ 10/20,
          sinon <strong>Redouble</strong>), avec le visa du Chef d’établissement.
        </p>
        <Select label="Classe" name="classe" value={classeId} onChange={(e) => setClasseId(e.target.value)} className="mt-4">
          <option value="">— Choisir une classe —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.cycle_nom} · {c.nom}</option>)}
        </Select>
        <Select label="Alias" name="alias" value={aliasId} onChange={(e) => setAliasId(e.target.value)} disabled={!classeId} className="mt-4">
          <option value="">— Choisir un alias —</option>
          {aliases.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </Select>
        <Button className="mt-4" onClick={apercuFiche} disabled={!aliasId || !periodeId || !peutImprimer}>
          Aperçu / Imprimer (PDF)
        </Button>
      </Card>

      <Card titre="Contenu de la fiche" className="mt-4">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--gris-600)', fontSize: 13, lineHeight: 1.9 }}>
          <li>En-tête République togolaise — Travail, Liberté, Patrie — Ministère de l’Éducation Nationale et identité de l’école</li>
          <li>Alias, période d’évaluation et année scolaire ; effectif, moyenne de la classe, nombre d’admis et taux de réussite</li>
          <li>Tableau des élèves : <strong>rang</strong>, nom et prénoms, <strong>moyenne générale</strong> et <strong>décision</strong> (admis / redouble)</li>
          <li>Visa et signature du Chef d’établissement — la décision reste indicative, le conseil de classe est souverain</li>
        </ul>
      </Card>

      {apercu && <ApercuPdf titre={apercu.titre} url={apercu.url} onFermer={() => setApercu(null)} />}
    </>
  );
}
