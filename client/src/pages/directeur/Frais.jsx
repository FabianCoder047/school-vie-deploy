// Frais de scolarité + modalités de paiement autorisées (Directeur).
// - Panneau groupé : sélection multiple de classes → applique montants + modalités
// - Tableau par classe : édition unitaire (montants + cases à cocher)
import { useEffect, useMemo, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';

const MODALITES = [
  { code: 'JOURNALIER', libelle: 'Journalier' },
  { code: 'HEBDOMADAIRE', libelle: 'Hebdomadaire' },
  { code: 'MENSUEL', libelle: 'Mensuel' },
  { code: 'TRIMESTRIEL', libelle: 'Trimestriel' },
  { code: 'SEMESTRIEL', libelle: 'Semestriel' },
];

export default function FraisPage() {
  const toast = useToast();
  const [annee, setAnnee] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  // Panneau groupé
  const [selection, setSelection] = useState({});
  const [groupe, setGroupe] = useState({ frais_inscription: '', montant_scolarite: '', modalites: ['MENSUEL'] });
  const [envoiGroupe, setEnvoiGroupe] = useState(false);

  // Édition unitaire (valeurs brouillon par class_id)
  const [brouillons, setBrouillons] = useState({});
  const [envoiLigne, setEnvoiLigne] = useState(null);

  const charger = () => {
    setChargement(true);
    api.get('/directeur/frais')
      .then(({ data }) => {
        setAnnee(data.annee);
        setLignes(data.lignes || []);
        const prochains = {};
        for (const l of data.lignes || []) {
          prochains[l.class_id] = {
            frais_inscription: l.frais_inscription != null ? String(Number(l.frais_inscription)) : '',
            montant_scolarite: l.montant_scolarite != null ? String(Number(l.montant_scolarite)) : '',
            modalites: l.modalites || [],
          };
        }
        setBrouillons(prochains);
      })
      .catch((err) => setErreur(messageErreur(err, 'Chargement impossible.')))
      .finally(() => setChargement(false));
  };

  useEffect(() => { charger(); }, []);

  const parCycle = useMemo(() => {
    const groupes = new Map();
    for (const l of lignes) {
      const cle = l.cycle_nom || 'Sans cycle';
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(l);
    }
    return [...groupes.entries()];
  }, [lignes]);

  const nbSelection = Object.values(selection).filter(Boolean).length;
  const toutSelectionne = lignes.length > 0 && lignes.every((l) => selection[l.class_id]);

  const basculerTout = () => {
    const prochain = {};
    if (!toutSelectionne) for (const l of lignes) prochain[l.class_id] = true;
    setSelection(prochain);
  };

  const appliquerGroupe = async (e) => {
    e.preventDefault();
    setErreur('');
    const classIds = Object.entries(selection).filter(([, v]) => v).map(([k]) => Number(k));
    if (classIds.length === 0) { setErreur('Sélectionnez au moins une classe.'); return; }
    if (groupe.modalites.length === 0) { setErreur('Cochez au moins une modalité.'); return; }
    setEnvoiGroupe(true);
    try {
      await api.put('/directeur/frais/groupe', {
        class_ids: classIds,
        frais_inscription: Number(groupe.frais_inscription),
        montant_scolarite: Number(groupe.montant_scolarite),
        modalites: groupe.modalites,
      });
      toast.succes(`Frais appliqués à ${classIds.length} classe(s).`);
      setSelection({});
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'Application groupée impossible.'));
    } finally {
      setEnvoiGroupe(false);
    }
  };

  const basculerModaliteGroupe = (code) => {
    setGroupe((g) => ({ ...g, modalites: g.modalites.includes(code) ? g.modalites.filter((m) => m !== code) : [...g.modalites, code] }));
  };

  const basculerModaliteLigne = (classId, code) => {
    setBrouillons((b) => {
      const actuel = b[classId]?.modalites || [];
      return { ...b, [classId]: { ...b[classId], modalites: actuel.includes(code) ? actuel.filter((m) => m !== code) : [...actuel, code] } };
    });
  };

  const enregistrerLigne = async (classId) => {
    setErreur('');
    const d = brouillons[classId];
    setEnvoiLigne(classId);
    try {
      await api.put('/directeur/frais/classe', {
        class_id: classId,
        frais_inscription: Number(d.frais_inscription),
        montant_scolarite: Number(d.montant_scolarite),
        modalites: d.modalites,
      });
      toast.succes('Frais enregistrés.');
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoiLigne(null);
    }
  };

  if (chargement) {
    return (
      <>
        <h1 className="page-titre">Frais de scolarité</h1>
        <div className="spinner" />
      </>
    );
  }

  return (
    <>
      <h1 className="page-titre">Frais de scolarité{annee ? ` — ${annee.libelle}` : ''}</h1>
      <p className="text-doux mb-4">Définissez les frais d’inscription et la scolarité annuelle par classe, ainsi que les <strong>modalités de paiement autorisées</strong> (cases à cocher). Ces frais seront figés dans chaque inscription.</p>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      {/* ===== Panneau groupé ===== */}
      <Card titre={`Appliquer à une sélection (${nbSelection} classe${nbSelection > 1 ? 's' : ''})`} className="mb-4">
        <form onSubmit={appliquerGroupe}>
          <div className="grid-2">
            <Input label="Frais d’inscription (FCFA)" name="gf" inputMode="decimal" value={groupe.frais_inscription} onChange={(e) => setGroupe({ ...groupe, frais_inscription: e.target.value })} placeholder="ex. 25000" requis />
            <Input label="Scolarité annuelle (FCFA)" name="gs" inputMode="decimal" value={groupe.montant_scolarite} onChange={(e) => setGroupe({ ...groupe, montant_scolarite: e.target.value })} placeholder="ex. 250000" requis />
          </div>
          <div className="mt-4">
            <span className="champ"><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gris-700)' }}>Modalités autorisées</span></span>
            <div className="flex gap-4 mt-4" style={{ flexWrap: 'wrap' }}>
              {MODALITES.map((m) => (
                <label key={m.code} className="flex gap-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={groupe.modalites.includes(m.code)} onChange={() => basculerModaliteGroupe(m.code)} />
                  <span>{m.libelle}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex-between mt-4" style={{ flexWrap: 'wrap', gap: 12 }}>
            <Button type="button" variant="ghost" onClick={basculerTout}>{toutSelectionne ? 'Tout désélectionner' : 'Tout sélectionner'}</Button>
            <Button type="submit" disabled={envoiGroupe || nbSelection === 0}>{envoiGroupe ? 'Application…' : 'Appliquer à la sélection'}</Button>
          </div>
        </form>
      </Card>

      {/* ===== Tableau par classe ===== */}
      {parCycle.map(([cycle, classesDuCycle]) => (
        <Card key={cycle} titre={cycle} className="mb-4">
          <div className="table-conteneur">
            <table className="tableau" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Classe</th>
                  <th>Frais d’inscription</th>
                  <th>Scolarité annuelle</th>
                  <th>Modalités autorisées</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {classesDuCycle.map((l) => {
                  const d = brouillons[l.class_id] || { frais_inscription: '', montant_scolarite: '', modalites: [] };
                  return (
                    <tr key={l.class_id}>
                      <td><input type="checkbox" checked={Boolean(selection[l.class_id])} onChange={(e) => setSelection((s) => ({ ...s, [l.class_id]: e.target.checked }))} aria-label={`Sélectionner ${l.classe_nom}`} /></td>
                      <td><strong>{l.classe_nom}</strong>{!l.frais_defini && <span className="badge badge-jaune" style={{ marginLeft: 8 }}>Non défini</span>}</td>
                      <td><input type="number" min="0" value={d.frais_inscription} onChange={(e) => setBrouillons((b) => ({ ...b, [l.class_id]: { ...d, frais_inscription: e.target.value } }))} style={{ width: 110, padding: '7px 9px', border: '1px solid var(--bordure)', borderRadius: 'var(--rayon-sm)' }} aria-label={`Frais d'inscription ${l.classe_nom}`} /></td>
                      <td><input type="number" min="0" value={d.montant_scolarite} onChange={(e) => setBrouillons((b) => ({ ...b, [l.class_id]: { ...d, montant_scolarite: e.target.value } }))} style={{ width: 120, padding: '7px 9px', border: '1px solid var(--bordure)', borderRadius: 'var(--rayon-sm)' }} aria-label={`Scolarité ${l.classe_nom}`} /></td>
                      <td>
                        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                          {MODALITES.map((m) => (
                            <label key={m.code} className="flex gap-2" style={{ alignItems: 'center', fontSize: 12, cursor: 'pointer' }} title={m.libelle}>
                              <input type="checkbox" checked={d.modalites.includes(m.code)} onChange={() => basculerModaliteLigne(l.class_id, m.code)} />
                              <span>{m.libelle.slice(0, 4)}.</span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button size="sm" variant="primary" disabled={envoiLigne === l.class_id} onClick={() => enregistrerLigne(l.class_id)}>
                          {envoiLigne === l.class_id ? '…' : 'Enregistrer'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </>
  );
}
