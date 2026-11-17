// Affectations :
//  Onglet 1 — Matière → classes (multi-sélection + coefficient par classe)
//  Onglet 2 — Professeur → (matière × alias × année)
import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import Tabs from '../../components/Tabs';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Select from '../../components/Select';
import Badge from '../../components/Badge';

export default function AffectationsPage() {
  const [onglet, setOnglet] = useState('matiere');
  return (
    <>
      <h1 className="page-titre">Affectations</h1>
      <Tabs
        ongletActif={onglet}
        onChange={setOnglet}
        tabs={[
          { id: 'matiere', label: 'Matière → classes (coefficients)' },
          { id: 'professeur', label: 'Professeur → matière × alias' },
        ]}
      />
      {onglet === 'matiere' ? <OngletMatiere /> : <OngletProfesseur />}
    </>
  );
}

/* ================================================================
   ONGLET 1 — Matière → classes + coefficient par classe
   ================================================================ */
function OngletMatiere() {
  const toast = useToast();
  const { supprimer } = useConfirm();
  const [matieres, setMatieres] = useState([]);
  const [classes, setClasses] = useState([]);
  const [matiereId, setMatiereId] = useState('');
  const [selection, setSelection] = useState({}); // class_id → coefficient (string)
  const [affectationsActuelles, setAffectationsActuelles] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get('/subjects/toutes').then(({ data }) => setMatieres(data || [])).catch(() => setMatieres([]));
    api.get('/classes/toutes').then(({ data }) => setClasses(data || [])).catch(() => setClasses([]));
  }, []);

  const rechargerAffectations = useCallback((id) => {
    if (!id) { setAffectationsActuelles([]); return; }
    api.get(`/directeur/affectations?subject_id=${id}`)
      .then(({ data }) => {
        setAffectationsActuelles(data || []);
        const prochain = {};
        for (const a of data || []) prochain[a.class_id] = String(Number(a.coefficient));
        setSelection(prochain);
      })
      .catch(() => setAffectationsActuelles([]));
  }, []);

  useEffect(() => { rechargerAffectations(matiereId); }, [matiereId, rechargerAffectations]);

  const basculerClasse = (classId) => {
    setSelection((sel) => {
      const copie = { ...sel };
      if (copie[classId] !== undefined) delete copie[classId];
      else copie[classId] = '1';
      return copie;
    });
  };

  const definirCoefficient = (classId, valeur) => {
    setSelection((sel) => ({ ...sel, [classId]: valeur }));
  };

  const enregistrer = async () => {
    setErreur('');
    const lignes = Object.entries(selection)
      .map(([class_id, coefficient]) => ({ class_id: Number(class_id), coefficient: Number(String(coefficient).replace(',', '.')) }))
      .filter((l) => l.coefficient > 0);
    if (!matiereId) { setErreur('Choisissez une matière.'); return; }
    if (lignes.length === 0) { setErreur('Sélectionnez au moins une classe avec un coefficient positif.'); return; }
    setEnvoi(true);
    try {
      await api.post('/directeur/affectations', { subject_id: Number(matiereId), affectations: lignes });
      toast.succes('Affectations enregistrées.');
      rechargerAffectations(matiereId);
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (affectation) => {
    const ok = await supprimer(`Retirer ${affectation.matiere_nom} de ${affectation.classe_nom} ?`, 'Retirer la matière');
    if (!ok) return;
    try {
      await api.delete(`/directeur/affectations/${affectation.id}`);
      toast.succes('Affectation retirée.');
      rechargerAffectations(matiereId);
    } catch (err) {
      toast.erreur(messageErreur(err, 'Retrait impossible.'));
    }
  };

  const parCycle = useMemo(() => {
    const groupes = new Map();
    for (const c of classes) {
      const cle = c.cycle_nom || 'Sans cycle';
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(c);
    }
    return [...groupes.entries()];
  }, [classes]);

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <Card titre="Affecter une matière à des classes">
        {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
        <Select label="Matière" name="matiere" value={matiereId} onChange={(e) => setMatiereId(e.target.value)} requis>
          <option value="">— Choisir une matière —</option>
          {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </Select>
        <p className="text-doux mt-4" style={{ fontSize: 13 }}>Cochez les classes puis ajustez le coefficient de chacune (pré-rempli à 1).</p>

        <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid var(--bordure)', borderRadius: 'var(--rayon-md)', padding: 'var(--espace-3)' }}>
          {parCycle.map(([cycle, classesDuCycle]) => (
            <div key={cycle} style={{ marginBottom: 'var(--espace-3)' }}>
              <div className="sidebar-section" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px', marginBottom: 6 }}>{cycle}</div>
              {classesDuCycle.map((classe) => {
                const coche = selection[classe.id] !== undefined;
                return (
                  <label key={classe.id} className="flex-between" style={{ gap: 8, padding: '6px 4px', borderBottom: '1px solid var(--gris-100)', cursor: 'pointer' }}>
                    <span className="flex gap-2" style={{ alignItems: 'center' }}>
                      <input type="checkbox" checked={coche} onChange={() => basculerClasse(classe.id)} />
                      <span>{classe.nom}</span>
                    </span>
                    {coche && (
                      <span className="flex gap-2" style={{ alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--texte-doux)' }}>Coef.</span>
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={selection[classe.id]}
                          onChange={(e) => definirCoefficient(classe.id, e.target.value)}
                          style={{ width: 72, padding: '6px 8px', border: '1px solid var(--bordure)', borderRadius: 'var(--rayon-sm)' }}
                          aria-label={`Coefficient pour ${classe.nom}`}
                        />
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          ))}
          {classes.length === 0 && <p className="text-doux">Aucune classe. Créez d’abord des classes (espace Admin).</p>}
        </div>

        <Button className="mt-4" onClick={enregistrer} disabled={envoi || !matiereId}>{envoi ? 'Enregistrement…' : 'Enregistrer les affectations'}</Button>
      </Card>

      <Card titre="Affectations actuelles de cette matière">
        {!matiereId ? (
          <p className="text-doux">Choisissez une matière pour voir où elle est affectée.</p>
        ) : affectationsActuelles.length === 0 ? (
          <p className="text-doux">Cette matière n’est affectée à aucune classe.</p>
        ) : (
          <table className="tableau" style={{ minWidth: 'auto' }}>
            <thead>
              <tr><th>Classe</th><th>Cycle</th><th>Coefficient</th><th></th></tr>
            </thead>
            <tbody>
              {affectationsActuelles.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.classe_nom}</strong></td>
                  <td><Badge couleur="bleu">{a.cycle_nom}</Badge></td>
                  <td>{Number(a.coefficient)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Button size="sm" variant="danger" onClick={() => retirer(a)}>Retirer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ================================================================
   ONGLET 2 — Professeur → (matière × alias × année)
   ================================================================ */
function OngletProfesseur() {
  const toast = useToast();
  const { supprimer } = useConfirm();
  const [professeurs, setProfesseurs] = useState([]);
  const [profId, setProfId] = useState('');
  const [affectationsMatiere, setAffectationsMatiere] = useState([]); // class_subjects
  const [choixCs, setChoixCs] = useState('');      // class_subject choisi
  const [aliasDisponibles, setAliasDisponibles] = useState([]);
  const [aliasCoches, setAliasCoches] = useState({});
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [affectationsProf, setAffectationsProf] = useState([]);

  useEffect(() => {
    api.get('/directeur/professeurs').then(({ data }) => setProfesseurs(data || [])).catch(() => setProfesseurs([]));
    api.get('/directeur/affectations').then(({ data }) => setAffectationsMatiere(data || [])).catch(() => setAffectationsMatiere([]));
  }, []);

  const rechargerAffectationsProf = useCallback((id) => {
    const url = `/directeur/affectations-professeur${id ? `?teacher_id=${id}` : ''}`;
    api.get(url).then(({ data }) => setAffectationsProf(data || [])).catch(() => setAffectationsProf([]));
  }, []);

  useEffect(() => { rechargerAffectationsProf(profId); }, [profId, rechargerAffectationsProf]);

  // Quand on choisit un couple matière×classe : charger ses alias
  useEffect(() => {
    setAliasDisponibles([]);
    setAliasCoches({});
    if (!choixCs) return;
    const cs = affectationsMatiere.find((a) => String(a.id) === String(choixCs));
    if (!cs) return;
    api.get(`/alias/classe/${cs.class_id}`).then(({ data }) => setAliasDisponibles(data || [])).catch(() => setAliasDisponibles([]));
  }, [choixCs, affectationsMatiere]);

  const ajouterAffectations = async () => {
    setErreur('');
    if (!profId) { setErreur('Choisissez un professeur.'); return; }
    const lignes = Object.entries(aliasCoches)
      .filter(([, coche]) => coche)
      .map(([class_alias_id]) => ({ class_subject_id: Number(choixCs), class_alias_id: Number(class_alias_id) }));
    if (!choixCs || lignes.length === 0) { setErreur('Choisissez une matière et au moins un alias.'); return; }
    setSauvegardeEnCours(true);
    try {
      await api.post('/directeur/affectations-professeur', { teacher_id: Number(profId), affectations: lignes });
      toast.succes('Professeur affecté.');
      setChoixCs('');
      setAliasCoches({});
      rechargerAffectationsProf(profId);
    } catch (err) {
      setErreur(messageErreur(err, 'Affectation impossible.'));
    } finally {
      setSauvegardeEnCours(false);
    }
  };

  const retirer = async (affectation) => {
    const ok = await supprimer(`Retirer ${affectation.prof_prenom} ${affectation.prof_nom} de ${affectation.matiere_nom} (${affectation.alias_nom}) ?`, 'Retirer l’affectation');
    if (!ok) return;
    try {
      await api.delete(`/directeur/affectations-professeur/${affectation.id}`);
      toast.succes('Affectation retirée.');
      rechargerAffectationsProf(profId);
    } catch (err) {
      toast.erreur(messageErreur(err, 'Retrait impossible.'));
    }
  };

  const csChoisi = affectationsMatiere.find((a) => String(a.id) === String(choixCs));

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <Card titre="Affecter un professeur">
        {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
        <Select label="Professeur" name="prof" value={profId} onChange={(e) => setProfId(e.target.value)} requis>
          <option value="">— Choisir un professeur —</option>
          {professeurs.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
        </Select>
        <div className="mt-4">
          <Select label="Matière (par classe)" name="cs" value={choixCs} onChange={(e) => setChoixCs(e.target.value)}>
            <option value="">— Choisir une matière affectée à une classe —</option>
            {affectationsMatiere.map((a) => (
              <option key={a.id} value={a.id}>{a.matiere_nom} — {a.classe_nom} (coef. {Number(a.coefficient)})</option>
            ))}
          </Select>
        </div>

        {csChoisi && (
          <div className="mt-4">
            <div className="champ"><label>Alias de la classe {csChoisi.classe_nom}</label></div>
            {aliasDisponibles.length === 0 ? (
              <p className="text-doux">La classe entière sera affectée comme un seul groupe (aucun alias défini par le Directeur).</p>
            ) : (
              aliasDisponibles.map((alias) => (
                <label key={alias.id} className="flex gap-2" style={{ alignItems: 'center', padding: '6px 4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(aliasCoches[alias.id])}
                    onChange={(e) => setAliasCoches((c) => ({ ...c, [alias.id]: e.target.checked }))}
                  />
                  <span>{alias.nom}</span>
                </label>
              ))
            )}
          </div>
        )}

        <Button className="mt-4" onClick={ajouterAffectations} disabled={sauvegardeEnCours || !profId || !choixCs}>
          {sauvegardeEnCours ? 'Affectation…' : 'Affecter le professeur'}
        </Button>
        <p className="text-doux mt-4" style={{ fontSize: 12 }}>Un seul professeur par matière et par alias pour une année scolaire. L’année utilisée est l’année courante.</p>
      </Card>

      <Card titre={profId ? 'Affectations du professeur sélectionné' : 'Affectations (toutes)'}>
        {affectationsProf.length === 0 ? (
          <p className="text-doux">Aucune affectation pour l’instant.</p>
        ) : (
          <table className="tableau" style={{ minWidth: 'auto' }}>
            <thead>
              <tr><th>Professeur</th><th>Matière</th><th>Classe / Alias</th><th></th></tr>
            </thead>
            <tbody>
              {affectationsProf.map((a) => (
                <tr key={a.id}>
                  <td>{a.prof_prenom} {a.prof_nom}</td>
                  <td>{a.matiere_nom}</td>
                  <td>{a.classe_nom} · <Badge couleur="bleu">{a.alias_nom}</Badge></td>
                  <td style={{ textAlign: 'right' }}>
                    <Button size="sm" variant="danger" onClick={() => retirer(a)}>Retirer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
