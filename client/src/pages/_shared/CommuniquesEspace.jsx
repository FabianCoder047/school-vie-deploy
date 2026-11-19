// Communiqués — créer un communiqué ciblé (tous, rôle, cycle, classe, alias) ;
// le système génère une notification pour chaque destinataire concerné.
// Partagé Directeur / Secrétaire (mêmes règles côté API).
import { useEffect, useMemo, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Textarea from '../../components/Textarea';
import Select from '../../components/Select';
import Badge from '../../components/Badge';

const ROLES = [
  { value: 'ADMIN', label: 'Administrateurs' },
  { value: 'DIRECTEUR', label: 'Directeurs' },
  { value: 'SECRETAIRE', label: 'Secrétaires' },
  { value: 'COMPTABLE', label: 'Comptables' },
  { value: 'PROFESSEUR', label: 'Professeurs' },
  { value: 'PARENT', label: 'Parents' },
];

export default function CommuniquesEspace({ espace = 'directeur' }) {
  const apiBase = espace === 'directeur' ? '/directeur' : '/secretaire';
  const toast = useToast();
  const [cycles, setCycles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [communiques, setCommuniques] = useState([]);
  const [chargement, setChargement] = useState(true);

  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [cibleTous, setCibleTous] = useState(false);
  const [rolesCoches, setRolesCoches] = useState({});
  const [cycleId, setCycleId] = useState('');
  const [classId, setClassId] = useState('');
  const [aliasId, setAliasId] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const recharger = () => {
    setChargement(true);
    api.get(`${apiBase}/communiques`)
      .then(({ data }) => setCommuniques(data || []))
      .catch(() => setCommuniques([]))
      .finally(() => setChargement(false));
  };

  useEffect(() => {
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
    api.get('/classes/toutes').then(({ data }) => setClasses(data || [])).catch(() => setClasses([]));
    recharger();
  }, []);

  useEffect(() => {
    setAliases([]);
    setAliasId('');
    if (!classId) return;
    api.get(`/alias/classe/${classId}`).then(({ data }) => setAliases(data || [])).catch(() => setAliases([]));
  }, [classId]);

  const nbCibles = [cibleTous ? 1 : 0, ...Object.values(rolesCoches).map((v) => (v ? 1 : 0)), cycleId ? 1 : 0, classId ? 1 : 0, aliasId ? 1 : 0].reduce((a, b) => a + b, 0);

  const construireCibles = () => {
    const cibles = [];
    if (cibleTous) cibles.push({ target_type: 'TOUS' });
    for (const [role, coche] of Object.entries(rolesCoches)) if (coche) cibles.push({ target_type: 'ROLE', role });
    if (cycleId) cibles.push({ target_type: 'CYCLE', cycle_id: Number(cycleId) });
    if (classId) cibles.push({ target_type: 'CLASSE', class_id: Number(classId) });
    if (aliasId) cibles.push({ target_type: 'ALIAS', class_alias_id: Number(aliasId) });
    return cibles;
  };

  const publier = async (e) => {
    e.preventDefault();
    setErreur('');
    const cibles = construireCibles();
    if (cibles.length === 0) { setErreur('Choisissez au moins un destinataire.'); return; }
    setEnvoi(true);
    try {
      const { data } = await api.post(`${apiBase}/communiques`, { titre: titre.trim(), contenu: contenu.trim(), cibles });
      toast.succes(`Communiqué publié — ${data.destinataires} destinataire(s) notifié(s).`);
      setTitre(''); setContenu(''); setCibleTous(false); setRolesCoches({}); setCycleId(''); setClassId(''); setAliasId('');
      recharger();
    } catch (err) {
      setErreur(messageErreur(err, 'Publication impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

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

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* ===== Formulaire de création ===== */}
        <Card titre="Nouveau communiqué">
          <form onSubmit={publier}>
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            <Input label="Titre" name="titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Réunion parents-professeurs" requis autoFocus />
            <div className="mt-4">
              <Textarea label="Contenu" name="contenu" rows={5} value={contenu} onChange={(e) => setContenu(e.target.value)} placeholder="Texte du communiqué…" requis />
            </div>

            <p className="sidebar-section mt-6" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px', marginBottom: 8 }}>Destinataires</p>
            <label className="flex gap-2" style={{ alignItems: 'center', padding: '6px 4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={cibleTous} onChange={(e) => setCibleTous(e.target.checked)} />
              <span><strong>Tout le monde</strong> (parents + personnel)</span>
            </label>
            <div className="flex gap-4 mt-4" style={{ flexWrap: 'wrap' }}>
              {ROLES.map((r) => (
                <label key={r.value} className="flex gap-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={Boolean(rolesCoches[r.value])} onChange={() => setRolesCoches((s) => ({ ...s, [r.value]: !s[r.value] }))} />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
            <div className="grid-3 mt-4">
              <Select label="Cycle (optionnel)" name="cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
                <option value="">—</option>
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </Select>
              <Select label="Classe (optionnel)" name="classe" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.cycle_nom} · {c.nom}</option>)}
              </Select>
              <Select label="Alias (optionnel)" name="alias" value={aliasId} onChange={(e) => setAliasId(e.target.value)} disabled={!classId}>
                <option value="">—</option>
                {aliases.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
              </Select>
            </div>

            <Button type="submit" className="mt-6 w-100" disabled={envoi || titre.trim().length < 3 || contenu.trim().length < 10 || nbCibles === 0}>
              {envoi ? 'Publication…' : `Publier le communiqué (${nbCibles} cible${nbCibles > 1 ? 's' : ''})`}
            </Button>
            <p className="text-doux mt-4" style={{ fontSize: 12 }}>Chaque destinataire concerné reçoit une notification interne (cloche). Les comptes visés : <strong>parents + personnel</strong> ayant un lien avec la cible (anciens/enseignants de la classe, etc.).</p>
          </form>
        </Card>

        {/* ===== Historique ===== */}
        <Card titre="Communiqués publiés">
          {chargement ? <div className="spinner" /> : communiques.length === 0 ? (
            <p className="text-doux">Aucun communiqué pour l’instant.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
              {communiques.map((c) => (
                <article key={c.id} className="card" style={{ background: 'var(--gris-50)', padding: 'var(--espace-3) var(--espace-4)' }}>
                  <div className="flex-between gap-2" style={{ alignItems: 'flex-start' }}>
                    <strong>{c.titre}</strong>
                    <span className="text-doux" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <p className="text-doux mt-4" style={{ fontSize: 13 }}>{c.contenu.length > 160 ? `${c.contenu.slice(0, 160)}…` : c.contenu}</p>
                  <p className="mt-4" style={{ fontSize: 12 }}><Badge couleur="bleu">{libelleCibles(c)}</Badge> — par {c.auteur_prenom} {c.auteur_nom}</p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
