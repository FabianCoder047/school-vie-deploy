// Saisie des notes — tableau « feuille Excel » :
//  - Interro / Devoir / Compo par élève, moyenne en direct
//  - navigation clavier (haut/bas, Tab, Entrée), virgule acceptée
//  - cellules modifiées surlignées, enregistrement groupé
//  - fenêtre de saisie stricte (verrouillage si période fermée)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { messageErreur } from '../../api/axios';
import { appreciation } from '../../utils/appreciation';
import { useToast } from '../../hooks/useToast';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Select from '../../components/Select';
import Input from '../../components/Input';

const COLS = ['interro', 'devoir', 'compo'];

function moyenneLigne(v) {
  const nums = ['interro', 'devoir']
    .map((k) => (v[k] === '' || v[k] == null ? null : Number(String(v[k]).replace(',', '.'))))
    .filter((n) => n != null && !Number.isNaN(n));
  const epreuves = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  const compo = v.compo === '' || v.compo == null ? null : Number(String(v.compo).replace(',', '.'));
  if (epreuves === null && (compo === null || Number.isNaN(compo))) return null;
  if (epreuves === null) return compo;
  if (compo === null || Number.isNaN(compo)) return epreuves;
  return (epreuves + compo) / 2;
}

export default function SaisieNotesPage() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [mesClasses, setMesClasses] = useState({ classes: [], annee: null });
  const [periodes, setPeriodes] = useState([]);
  const [aliasId, setAliasId] = useState(searchParams.get('alias') || '');
  const [classSubjectId, setClassSubjectId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [feuille, setFeuille] = useState(null);
  const [valeurs, setValeurs] = useState({});      // enrollmentId -> {interro, devoir, compo}
  const [initiales, setInitiales] = useState({});  // pour surligner les modifiées
  const [chargement, setChargement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const inputsRef = useRef({});

  // Charge mes classes et les périodes
  useEffect(() => {
    api.get('/professeur/mes-classes').then(({ data }) => {
      setMesClasses(data);
      if (!aliasId && data.classes.length > 0) setAliasId(String(data.classes[0].alias_id));
    }).catch(() => setErreur('Impossible de charger vos classes.'));
    api.get('/periodes').then(({ data }) => setPeriodes(data.periodes || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matieresPourAlias = useMemo(
    () => mesClasses.classes.filter((c) => String(c.alias_id) === String(aliasId)),
    [mesClasses, aliasId]
  );
  useEffect(() => {
    setClassSubjectId('');
    if (matieresPourAlias.length > 0) setClassSubjectId(String(matieresPourAlias[0].class_subject_id));
  }, [matieresPourAlias]);
  useEffect(() => {
    if (periodes.length > 0 && !periodeId) setPeriodeId(String(periodes[0].id));
  }, [periodes, periodeId]);

  const chargerFeuille = useCallback(() => {
    if (!aliasId || !classSubjectId || !periodeId) { setFeuille(null); return; }
    setChargement(true);
    setErreur('');
    api.get(`/professeur/feuille?class_alias_id=${aliasId}&class_subject_id=${classSubjectId}&evaluation_period_id=${periodeId}`)
      .then(({ data }) => {
        setFeuille(data);
        const vals = {};
        const init = {};
        for (const l of data.lignes) {
          vals[l.enrollment_id] = {
            interro: l.interro != null ? String(l.interro) : '',
            devoir: l.devoir != null ? String(l.devoir) : '',
            compo: l.compo != null ? String(l.compo) : '',
          };
          init[l.enrollment_id] = { ...vals[l.enrollment_id] };
        }
        setValeurs(vals);
        setInitiales(init);
      })
      .catch((err) => setErreur(messageErreur(err, 'Chargement de la feuille impossible.')))
      .finally(() => setChargement(false));
  }, [aliasId, classSubjectId, periodeId]);

  useEffect(() => { chargerFeuille(); }, [chargerFeuille]);

  const modifiable = Boolean(feuille?.modifiable);

  const cellulesModifiees = useMemo(() => {
    const modifiees = new Set();
    for (const [id, v] of Object.entries(valeurs)) {
      const init = initiales[id] || {};
      for (const c of COLS) {
        if ((v[c] ?? '') !== (init[c] ?? '')) modifiees.add(`${id}:${c}`);
      }
    }
    return modifiees;
  }, [valeurs, initiales]);

  const setCellule = (enrollmentId, col, valeur) => {
    // Accepte virgule comme séparateur décimal, borne 0-20 appliquée à l'enregistrement
    setValeurs((v) => ({ ...v, [enrollmentId]: { ...v[enrollmentId], [col]: valeur } }));
  };

  const celluleInvalide = (col, valeur) => {
    if (valeur === '' || valeur == null) return false;
    const n = Number(String(valeur).replace(',', '.'));
    return Number.isNaN(n) || n < 0 || n > 20;
  };

  // ---- Navigation clavier : haut / bas / Entrée ↓ / Tab (défaut) ----
  const onKeyDown = (e, rowIndex, colIndex) => {
    const cibles = [];
    if (e.key === 'ArrowDown' || e.key === 'Enter') cibles.push([rowIndex + 1, colIndex]);
    else if (e.key === 'ArrowUp') cibles.push([rowIndex - 1, colIndex]);
    else return;
    e.preventDefault();
    const [r, c] = cibles[0];
    const cible = inputsRef.current[`${rows[r]?.enrollment_id}:${COLS[c]}`];
    cible?.focus();
    cible?.select?.();
  };

  // ---- Enregistrement ----
  const enregistrer = async () => {
    if (!feuille) return;
    setErreur('');
    setEnvoi(true);
    try {
      const notes = feuille.lignes
        .filter((l) => COLS.some((c) => (valeurs[l.enrollment_id]?.[c] ?? '') !== (initiales[l.enrollment_id]?.[c] ?? '')))
        .map((l) => {
          const v = valeurs[l.enrollment_id];
          const norme = (x) => (x === '' || x == null ? null : Number(String(x).replace(',', '.')));
          return { enrollment_id: l.enrollment_id, interro: norme(v.interro), devoir: norme(v.devoir), compo: norme(v.compo) };
        });
      if (notes.length === 0) { toast.info('Aucune modification à enregistrer.'); return; }
      if (notes.some((n) => [n.interro, n.devoir, n.compo].some((x) => x !== null && (Number.isNaN(x) || x < 0 || x > 20)))) {
        setErreur('Chaque note doit être entre 0 et 20.');
        return;
      }
      await api.put('/professeur/feuille', { class_alias_id: Number(aliasId), class_subject_id: Number(classSubjectId), evaluation_period_id: Number(periodeId), notes });
      toast.succes(`${notes.length} ligne(s) enregistrée(s).`);
      chargerFeuille();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const rows = feuille?.lignes || [];
  const periodeChoisie = periodes.find((p) => String(p.id) === String(periodeId));
  const fenetre = feuille?.periode?.fenetre || periodeChoisie?.fenetre;

  return (
    <>
      <h1 className="page-titre">Saisie des notes</h1>

      {/* ===== Sélecteurs ===== */}
      <div className="filtres-outil mb-4">
        <Select label="Classe / Alias" name="alias" className="select-fluide" value={aliasId} onChange={(e) => setAliasId(e.target.value)}>
          <option value="">— Choisir —</option>
          {mesClasses.classes.map((c) => <option key={c.alias_id} value={c.alias_id}>{c.classe_nom} · {c.alias_nom}</option>)}
        </Select>
        <Select label="Matière" name="matiere" className="select-fluide" value={classSubjectId} onChange={(e) => setClassSubjectId(e.target.value)}>
          <option value="">— Choisir —</option>
          {matieresPourAlias.map((m) => <option key={m.class_subject_id} value={m.class_subject_id}>{m.matiere_nom}</option>)}
        </Select>
        <Select label="Période" name="periode" className="select-fluide" value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
          <option value="">— Choisir —</option>
          {periodes.map((p) => <option key={p.id} value={p.id}>{p.libelle}{p.fenetre?.ouverte ? ' (ouverte)' : ' (fermée)'}</option>)}
        </Select>
        {fenetre && (
          <Badge couleur={fenetre.ouverte ? 'vert' : 'rouge'}>{fenetre.ouverte ? 'Saisie ouverte' : 'Saisie fermée'}</Badge>
        )}
      </div>

      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      {/* ===== Bandeau verrouillage ===== */}
      {feuille && !modifiable && (
        <div className="auth-erreur mb-4" role="alert">
          <strong>La saisie des notes est fermée pour cette période.</strong><br />
          {fenetre?.motif || 'La fenêtre définie par le Directeur est close.'}
        </div>
      )}

      {/* ===== Feuille ===== */}
      {chargement ? (
        <div className="spinner" />
      ) : rows.length === 0 ? (
        <Card><p className="text-doux">Aucun élève dans cette classe/alias, ou choisissez une classe et une matière.</p></Card>
      ) : (
        <>
          <div className="table-conteneur" style={{ maxHeight: '62vh' }}>
            <table className="tableau masquable-matricule" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th className="col-matricule">Matricule</th><th>Nom</th><th>Prénom</th>
                  <th style={{ width: 90 }}>Interro /20</th><th style={{ width: 90 }}>Devoir /20</th><th style={{ width: 90 }}>Compo /20</th>
                  <th style={{ width: 90 }}>Moyenne</th><th style={{ width: 110 }}>Appréciation <span style={{ fontWeight: 400 }}>(auto)</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l, rowIndex) => {
                  const v = valeurs[l.enrollment_id] || {};
                  const moyenne = moyenneLigne(v);
                  const ligneModifiee = COLS.some((c) => (valeurs[l.enrollment_id]?.[c] ?? '') !== (initiales[l.enrollment_id]?.[c] ?? ''));
                  return (
                    <tr key={l.enrollment_id} style={ligneModifiee ? { background: 'var(--jaune-50)' } : undefined}>
                      <td className="col-matricule"><code style={{ fontSize: 12 }}>{l.matricule}</code></td>
                      <td><strong>{l.nom}</strong></td>
                      <td>{l.prenom}</td>
                      {COLS.map((col, colIndex) => {
                        const key = `${l.enrollment_id}:${col}`;
                        const invalide = celluleInvalide(col, v[col]);
                        const modifiee = cellulesModifiees.has(`${l.enrollment_id}:${col}`);
                        return (
                          <td key={col} style={{ padding: '4px 6px' }}>
                            <input
                              ref={(el) => { inputsRef.current[key] = el; }}
                              type="text"
                              inputMode="decimal"
                              disabled={!modifiable}
                              value={v[col] ?? ''}
                              onChange={(e) => setCellule(l.enrollment_id, col, e.target.value)}
                              onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
                              placeholder="—"
                              aria-label={`${col} de ${l.prenom} ${l.nom}`}
                              style={{
                                width: '100%', padding: '7px 8px', textAlign: 'center',
                                border: `1px solid ${invalide ? 'var(--rouge-500)' : modifiee ? 'var(--jaune-500)' : 'var(--bordure)'}`,
                                borderRadius: 'var(--rayon-sm)',
                                background: invalide ? 'var(--rouge-50)' : modifiee ? '#fffbeb' : '#fff',
                                fontWeight: 600,
                              }}
                            />
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 800, color: moyenne !== null ? (moyenne >= 10 ? 'var(--vert-700)' : 'var(--rouge-700)') : 'var(--gris-400)' }}>
                        {moyenne !== null ? moyenne.toFixed(2) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {moyenne !== null
                          ? <span style={{ fontSize: 12, color: 'var(--texte-doux)' }}>{appreciation(moyenne)}</span>
                          : <span style={{ color: 'var(--gris-400)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex-between mt-4" style={{ flexWrap: 'wrap', gap: 12 }}>
            <span className="text-doux" style={{ fontSize: 13 }}>{cellulesModifiees.size} cellule(s) modifiée(s) non enregistrée(s) — moyenne de ligne en direct, navigation clavier ↑ ↓ Entrée.</span>
            <div className="boutons-pied">
              <Button variant="secondary" onClick={chargerFeuille} disabled={chargement}>Recharger</Button>
              <Button onClick={enregistrer} disabled={envoi || !modifiable || cellulesModifiees.size === 0}>
                {envoi ? 'Enregistrement…' : `Enregistrer (${cellulesModifiees.size})`}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
