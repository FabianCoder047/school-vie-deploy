// Cartes scolaires — aperçu avant impression (PDF à la volée),
// par classe (alias), par classe entière ou par cycle. 8 cartes/page A4.
// Partagé Directeur / Secrétaire ; côté Secrétaire, le directeur doit avoir donné le feu vert.
import { useEffect, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Select from '../../components/Select';
import ApercuPdf from '../../components/ApercuPdf';
import FeuVertImpression from '../../components/FeuVertImpression';

export default function CartesEspace({ espace = 'directeur' }) {
  const apiBase = espace === 'directeur' ? '/directeur' : '/secretaire';
  const estDirecteur = espace === 'directeur';
  const colonne = 'cartes_impression_autorisee';
  const type = 'cartes';
  // Feu vert : lecture du drapeau (la secrétaire ne peut pas générer le PDF tant qu'il est coupé) ;
  // le directeur imprime toujours librement. Resynchro via l'événement 'feu-vert-change'.
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
  const [cycles, setCycles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState('');
  const [aliasId, setAliasId] = useState('');
  const [aliases, setAliases] = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [erreur, setErreur] = useState('');
  const [apercu, setApercu] = useState(null); // { url, titre }

  useEffect(() => {
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
    api.get('/classes/toutes').then(({ data }) => setClasses(data || [])).catch(() => setClasses([]));
  }, []);
  useEffect(() => {
    setAliases([]);
    setAliasId('');
    if (!classeId) return;
    api.get(`/alias/classe/${classeId}`).then(({ data }) => setAliases(data || [])).catch(() => setAliases([]));
  }, [classeId]);

  const apercuAlias = () => {
    setErreur('');
    if (!aliasId) { setErreur('Choisissez un alias.'); return; }
    const alias = aliases.find((a) => String(a.id) === String(aliasId));
    setApercu({ url: `${apiBase}/cartes/alias/${aliasId}`, titre: `Cartes scolaires — ${alias?.nom || 'classe'}` });
  };

  const apercuCycle = () => {
    setErreur('');
    if (!cycleId) { setErreur('Choisissez un cycle.'); return; }
    const cycle = cycles.find((c) => String(c.id) === String(cycleId));
    setApercu({ url: `${apiBase}/cartes/cycle/${cycleId}`, titre: `Cartes scolaires — Cycle ${cycle?.nom || ''}` });
  };

  return (
    <>
      <h1 className="page-titre">Cartes scolaires</h1>
      {estDirecteur && <FeuVertImpression type="cartes" />}
      {!estDirecteur && autorisation === false && (
        <div className="auth-erreur mb-4" role="alert">Le directeur n’a pas encore donné le feu vert pour l’impression des cartes scolaires. Les boutons sont désactivés ; vous les retrouverez dès son autorisation.</div>
      )}
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* ===== Par classe / alias ===== */}
        <Card titre="Par classe ou par alias">
          <p className="text-doux">Génère un PDF avec les cartes des élèves de la classe/alias choisi — <strong>8 cartes par page A4</strong>, QR code du matricule sur chaque carte.</p>
          <Select label="Classe" name="classe" value={classeId} onChange={(e) => setClasseId(e.target.value)} className="mt-4">
            <option value="">— Choisir une classe —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.cycle_nom} · {c.nom}</option>)}
          </Select>
          <Select label="Alias (classe entière si un seul)" name="alias" value={aliasId} onChange={(e) => setAliasId(e.target.value)} disabled={!classeId} className="mt-4">
            <option value="">— Choisir un alias —</option>
            {aliases.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </Select>
          <Button className="mt-4" onClick={apercuAlias} disabled={!aliasId || !peutImprimer}>
            Aperçu / Imprimer (PDF)
          </Button>
          <p className="text-doux mt-4" style={{ fontSize: 12 }}>L’aperçu s’ouvre dans une fenêtre de l’application ; vous pourrez alors imprimer ou télécharger.</p>
        </Card>

        {/* ===== Par cycle ===== */}
        <Card titre="Par cycle entier">
          <p className="text-doux">Génère un PDF unique avec les cartes de tous les élèves du cycle choisi.</p>
          <Select label="Cycle" name="cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)} className="mt-4">
            <option value="">— Choisir un cycle —</option>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Select>
          <Button className="mt-4" variant="secondary" onClick={apercuCycle} disabled={!cycleId || !peutImprimer}>
            Aperçu / Imprimer (PDF)
          </Button>
        </Card>
      </div>

      {/* Aperçu dans l'application */}
      {apercu && <ApercuPdf titre={apercu.titre} url={apercu.url} onFermer={() => setApercu(null)} />}
    </>
  );
}
