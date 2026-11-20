// Emploi du temps par cycle → classe → alias (Directeur / Secrétaire — même écran partagé).
// Vue semaine, création / déplacement / suppression. Règles horaires centralisées
// côté API (/edt-config) : 07:00, 55 min/heure, pause 09:45–10:10, 12:00,
// retour 14:30, primaire → fin 11:30 avec durée libre.
import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import Calendar from '../../components/Calendar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Select from '../../components/Select';
import ApercuPdf from '../../components/ApercuPdf';
import FeuVertImpression from '../../components/FeuVertImpression';
import {
  REGLES_DEFAUT, enMinutes, enHeure, heureDepuisY, debutsPossibles, segmentsDepuisRegles,
} from '../../components/horairesEdt';

const JOURS_LABEL = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

export default function EmploiDuTempsEspace({ espace = 'directeur' }) {
  const apiBase = espace === 'directeur' ? '/directeur' : '/secretaire';
  const estDirecteur = espace === 'directeur';
  const toast = useToast();
  const { supprimer } = useConfirm();
  const [cycles, setCycles] = useState([]);
  const [config, setConfig] = useState(null);
  const [classesFiltrees, setClassesFiltrees] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [cycleId, setCycleId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [aliasId, setAliasId] = useState('');
  const [annee, setAnnee] = useState(null);
  const [creneaux, setCreneaux] = useState([]);
  const [affectations, setAffectations] = useState([]);
  const [chargement, setChargement] = useState(false);

  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState({
    teacher_assignment_id: '', jour_semaine: 2, heure_debut: '07:00', heure_fin: '09:45',
    periode: 'matin1', nb_heures: 1, salle: '',
  });

  // Feu vert du directeur pour l'impression par la secrétaire.
  const [autorisationEdt, setAutorisationEdt] = useState(estDirecteur ? true : null);
  const [apercu, setApercu] = useState(null); // { url, titre }
  useEffect(() => {
    let actif = true;
    api.get('/parametres')
      .then(({ data }) => { if (actif) setAutorisationEdt(Boolean(data?.edts_impression_autorisee)); })
      .catch(() => { if (actif) setAutorisationEdt(false); });
    const surFeuVert = (e) => { if (e.detail?.type === 'edts') setAutorisationEdt(Boolean(e.detail.autorisee)); };
    window.addEventListener('feu-vert-change', surFeuVert);
    const minuteur = window.setInterval(() => {
      api.get('/parametres').then(({ data }) => { if (actif) setAutorisationEdt(Boolean(data?.edts_impression_autorisee)); }).catch(() => {});
    }, 30000);
    return () => {
      actif = false;
      window.removeEventListener('feu-vert-change', surFeuVert);
      window.clearInterval(minuteur);
    };
  }, []);
  const peutImprimer = estDirecteur || autorisationEdt === true;

  const regles = config?.regles || REGLES_DEFAUT;
  const duree = regles.dureeHeureMinutes || 55;
  const estPrimaire = Boolean(cycleId && config?.cyclesPrimaire?.map(Number).includes(Number(cycleId)));
  const segments = useMemo(() => segmentsDepuisRegles(regles, estPrimaire), [regles, estPrimaire]);

  // Primaire : durée libre, mais bornes selon le moment de la journée.
  const periodeDepuisHeure = (heure) => {
    const t = enMinutes(heure);
    if (t < enMinutes(regles.pause.debut)) return 'matin1';
    if (t < enMinutes(regles.debutApresMidi)) return 'matin2';
    return 'apresmidi';
  };
  const bornesPeriode = (periode) => {
    if (periode === 'matin1') {
      return { debutMin: regles.debutJournee, debutMax: regles.pause.debut, finMin: regles.pause.fin, finMax: regles.finPrimaire };
    }
    if (periode === 'matin2') {
      return { debutMin: regles.pause.fin, debutMax: regles.finPrimaire, finMin: regles.pause.fin, finMax: regles.finPrimaire };
    }
    return { debutMin: regles.debutApresMidi, debutMax: regles.finApresMidi, finMin: regles.debutApresMidi, finMax: regles.finApresMidi };
  };
  const heureFinDefaut = (periode) => (
    periode === 'matin1' ? regles.pause.debut : (periode === 'matin2' ? regles.finPrimaire : regles.finApresMidi)
  );

  // Référentiels + horaires
  useEffect(() => {
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
    api.get('/annees-academiques/courante').then(({ data }) => setAnnee(data)).catch(() => setAnnee(null));
    api.get('/edt-config').then(({ data }) => setConfig(data)).catch(() => setConfig(null));
  }, []);
  useEffect(() => {
    setClassesFiltrees([]);
    setAliases([]);
    setClasseId('');
    setAliasId('');
    if (!cycleId) return;
    api.get(`/classes?cycle_id=${cycleId}&parPage=100`).then(({ data }) => setClassesFiltrees(data.rows || [])).catch(() => setClassesFiltrees([]));
  }, [cycleId]);
  useEffect(() => {
    setAliases([]);
    setAliasId('');
    if (!classeId) return;
    api.get(`/alias/classe/${classeId}`).then(({ data }) => setAliases(data || [])).catch(() => setAliases([]));
  }, [classeId]);

  // Chargement des créneaux + affectations
  const charger = useCallback(() => {
    if (!aliasId) { setCreneaux([]); setAffectations([]); return; }
    setChargement(true);
    Promise.all([
      api.get(`${apiBase}/edt?class_alias_id=${aliasId}`),
      api.get(`${apiBase}/edt-affectations?class_alias_id=${aliasId}`),
    ])
      .then(([c, a]) => { setCreneaux(c.data || []); setAffectations(a.data || []); })
      .catch((err) => setErreur(messageErreur(err, 'Chargement impossible.')))
      .finally(() => setChargement(false));
  }, [aliasId, apiBase]);
  useEffect(() => { charger(); }, [charger]);

  const creneauxInvalides = useMemo(() => {
    const debutAutories = estPrimaire ? [] : debutsPossibles(regles);
    return creneaux.filter((c) => {
      const debut = String(c.heure_debut).slice(0, 5);
      const fin = String(c.heure_fin).slice(0, 5);
      const dansPlage = segments.some((s) => s.type === 'cours'
        && enMinutes(debut) >= enMinutes(s.debut) && enMinutes(fin) <= enMinutes(s.fin));
      return !dansPlage || (!estPrimaire && !debutAutories.includes(debut));
    });
  }, [creneaux, segments, estPrimaire, regles]);

  const evenements = useMemo(() => creneaux.map((c) => ({
    id: c.id,
    jour: c.jour_semaine,
    heureDebut: String(c.heure_debut).slice(0, 5),
    heureFin: String(c.heure_fin).slice(0, 5),
    titre: c.matiere_nom,
    sousTitre: `${c.prof_prenom} ${c.prof_nom}${c.salle ? ` · Salle ${c.salle}` : ''}`,
    brut: c,
  })), [creneaux]);

  const debuts = useMemo(() => {
    if (estPrimaire) return [];
    const liste = debutsPossibles(regles);
    const courant = String(form.heure_debut || '').slice(0, 5);
    return courant && !liste.includes(courant) ? [courant, ...liste] : liste;
  }, [estPrimaire, regles, form.heure_debut]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    setErreur('');
    setForm({
      teacher_assignment_id: affectations[0]?.teacher_assignment_id || '',
      jour_semaine: 2,
      heure_debut: estPrimaire ? regles.debutJournee : (debutsPossibles(regles)[0] || regles.debutJournee),
      heure_fin: estPrimaire ? regles.pause.debut : '',
      periode: 'matin1',
      nb_heures: 1,
      salle: '',
    });
    setModalOuvert(true);
  };

  const ouvrirEdition = (ev) => {
    const c = ev.brut;
    setEnEdition(c);
    setErreur('');
    setForm({
      teacher_assignment_id: c.teacher_assignment_id,
      jour_semaine: c.jour_semaine,
      heure_debut: String(c.heure_debut).slice(0, 5),
      heure_fin: String(c.heure_fin).slice(0, 5),
      periode: periodeDepuisHeure(String(c.heure_debut).slice(0, 5)),
      nb_heures: c.duree_libre ? 1 : (c.nb_heures || 1),
      salle: c.salle || '',
    });
    setModalOuvert(true);
  };

  const heureFin = useMemo(() => {
    if (estPrimaire) return form.heure_fin;
    return enHeure(enMinutes(form.heure_debut) + Number(form.nb_heures || 1) * duree);
  }, [estPrimaire, form.heure_fin, form.heure_debut, form.nb_heures, duree]);

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!form.teacher_assignment_id) { setErreur('Choisissez une matière/professeur.'); return; }
    setEnvoi(true);
    const payload = {
      class_alias_id: Number(aliasId),
      teacher_assignment_id: Number(form.teacher_assignment_id),
      jour_semaine: Number(form.jour_semaine),
      heure_debut: form.heure_debut,
      salle: form.salle.trim() || null,
    };
    if (estPrimaire) payload.heure_fin = form.heure_fin;
    else payload.nb_heures = Number(form.nb_heures);
    try {
      if (enEdition) await api.put(`${apiBase}/edt/${enEdition.id}`, payload);
      else await api.post(`${apiBase}/edt`, payload);
      toast.succes(enEdition ? 'Créneau mis à jour.' : 'Créneau créé.');
      setModalOuvert(false);
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async () => {
    if (!enEdition) return;
    const ok = await supprimer(`Supprimer le créneau « ${enEdition.matiere_nom} » du ${JOURS_LABEL[enEdition.jour_semaine - 1]} à ${String(enEdition.heure_debut).slice(0, 5)} ?`, 'Supprimer le créneau');
    if (!ok) return;
    try {
      await api.delete(`${apiBase}/edt/${enEdition.id}`);
      toast.succes('Créneau supprimé.');
      setModalOuvert(false);
      charger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Suppression impossible.'));
    }
  };

  // ---- Drag & drop : déplacement vers un autre jour / horaire ----
  const onDragStart = (e, ev) => {
    e.dataTransfer.setData('text/plain', String(ev.id));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDropSurJour = async (e, jour, y) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain'));
    const creneau = creneaux.find((c) => c.id === id);
    if (!creneau || estPrimaire) return;
    const brut = heureDepuisY(segments, y, duree);
    const liste = debutsPossibles(regles);
    const heureDebut = liste.reduce((meilleur, candidat) => (
      Math.abs(enMinutes(candidat) - enMinutes(brut)) < Math.abs(enMinutes(meilleur) - enMinutes(brut)) ? candidat : meilleur
    ), liste[0] || brut);
    try {
      await api.put(`${apiBase}/edt/${id}`, {
        class_alias_id: creneau.class_alias_id,
        teacher_assignment_id: creneau.teacher_assignment_id,
        jour_semaine: jour,
        heure_debut: heureDebut,
        nb_heures: creneau.nb_heures || 1,
        salle: creneau.salle || null,
      });
      toast.succes('Créneau déplacé.');
      charger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Déplacement impossible.'));
    }
  };

  const imprimer = (portee) => {
    if (!peutImprimer) return;
    const aliasNom = aliases.find((a) => String(a.id) === String(aliasId))?.nom || '';
    const classeNom = classesFiltrees.find((c) => String(c.id) === String(classeId))?.nom || '';
    const cycleNom = cycles.find((c) => String(c.id) === String(cycleId))?.nom || '';
    if (portee === 'alias' && aliasId) {
      setApercu({ url: `${apiBase}/edt/pdf?class_alias_id=${aliasId}`, titre: `Emploi du temps — ${aliasNom}` });
    } else if (portee === 'classe' && classeId) {
      setApercu({ url: `${apiBase}/edt/pdf/classe?classe_id=${classeId}`, titre: `Emplois du temps — Classe ${classeNom}` });
    } else if (portee === 'cycle' && cycleId) {
      setApercu({ url: `${apiBase}/edt/pdf/cycle?cycle_id=${cycleId}`, titre: `Emplois du temps — Cycle ${cycleNom}` });
    }
  };

  return (
    <>
      <h1 className="page-titre">Emploi du temps{annee ? ` — ${annee.libelle}` : ''}</h1>
      <p className="text-doux mb-2">
        Début {regles.debutJournee} · 1 h = {duree} min · pause {regles.pause.debut}–{regles.pause.fin} ·
        {' '}matinée jusqu’à {regles.finMatin} · retour à {regles.debutApresMidi}–{regles.finApresMidi}.
        {' '}Primaire : matin jusqu’à {regles.finPrimaire}, retour à {regles.debutApresMidi}, durée libre.
      </p>
      <p className="text-doux mb-4">Déplacez les créneaux par glisser-déposer (collège / lycée), cliquez pour modifier. Les chevauchements et les créneaux hors horaires sont refusés.</p>

      {estDirecteur && <FeuVertImpression type="edts" />}
      {!estDirecteur && autorisationEdt === false && (
        <div className="auth-erreur mb-4" role="alert">Le directeur n’a pas encore donné le feu vert pour l’impression des emplois du temps. Les boutons d’impression sont désactivés.</div>
      )}

      {/* ===== Sélecteurs en cascade ===== */}
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <Select label="Cycle" name="cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">— Choisir —</option>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>
        <Select label="Classe" name="classe" value={classeId} onChange={(e) => setClasseId(e.target.value)} disabled={!cycleId} style={{ minWidth: 140 }}>
          <option value="">— Choisir —</option>
          {classesFiltrees.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>
        <Select label="Alias" name="alias" value={aliasId} onChange={(e) => setAliasId(e.target.value)} disabled={!classeId} style={{ minWidth: 140 }}>
          <option value="">— Choisir —</option>
          {aliases.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </Select>
        {aliasId && <Button onClick={ouvrirCreation} style={{ alignSelf: 'flex-end' }}>+ Créneau</Button>}
      </div>

      {erreur && !modalOuvert && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}
      {chargement && <div className="spinner" />}
      {!aliasId && <Card><p className="text-doux">Choisissez un cycle, une classe puis un alias pour voir son emploi du temps.</p></Card>}

      {creneauxInvalides.length > 0 && (
        <div className="mb-4" role="alert" style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', borderRadius: 'var(--rayon-sm)', padding: '10px 12px', fontSize: 13 }}>
          <strong>{creneauxInvalides.length} créneau(x) hors des horaires</strong> (pause, fin de matinée ou retour à 14h30).
          Cliquez dessus pour corriger l’heure de début ou de fin.
        </div>
      )}

      {aliasId && !chargement && (
        <Calendar
          evenements={evenements}
          config={config}
          estPrimaire={estPrimaire}
          onEvenementClick={ouvrirEdition}
          onDragStart={estPrimaire ? undefined : onDragStart}
          onDropSurJour={estPrimaire ? undefined : onDropSurJour}
        />
      )}

      {/* ===== Impression ===== */}
      <Card titre="Impression des emplois du temps" className="mt-6">
        <p className="text-doux">PDF prêt à imprimer (A4 paysage, une page par alias) : grille Lundi → Vendredi, pause et horaires du cycle. Aperçu avant impression.</p>
        <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
          <Button variant="secondary" disabled={!aliasId || !peutImprimer} onClick={() => imprimer('alias')}>Imprimer cet alias</Button>
          <Button variant="secondary" disabled={!classeId || !peutImprimer} onClick={() => imprimer('classe')}>Imprimer la classe</Button>
          <Button variant="secondary" disabled={!cycleId || !peutImprimer} onClick={() => imprimer('cycle')}>Imprimer le cycle</Button>
        </div>
      </Card>

      {apercu && <ApercuPdf titre={apercu.titre} url={apercu.url} onFermer={() => setApercu(null)} />}

      {/* ===== Modal création / édition ===== */}
      {modalOuvert && (
        <Modal titre={enEdition ? 'Modifier le créneau' : 'Nouveau créneau'} onFermer={() => setModalOuvert(false)}
          footer={(
            <>
              {enEdition && <Button variant="danger" onClick={retirer}>Supprimer</Button>}
              <span style={{ flex: 1 }} />
              <Button variant="secondary" onClick={() => setModalOuvert(false)}>Annuler</Button>
              <Button type="submit" form="form-creneau" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          )}>
          <form id="form-creneau" onSubmit={enregistrer}>
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            <Select label="Matière & professeur" name="assignation" value={form.teacher_assignment_id} onChange={(e) => setForm({ ...form, teacher_assignment_id: e.target.value })} requis>
              <option value="">— Choisir —</option>
              {affectations.map((a) => <option key={a.teacher_assignment_id} value={a.teacher_assignment_id}>{a.matiere_nom} — {a.prof_prenom} {a.prof_nom}</option>)}
            </Select>
            {estPrimaire && (
              <Select label="Moment" name="periode" value={form.periode} className="mt-4" onChange={(e) => {
                const periode = e.target.value;
                const b = bornesPeriode(periode);
                setForm((f) => ({ ...f, periode, heure_debut: b.debutMin, heure_fin: heureFinDefaut(periode) }));
              }}>
                <option value="matin1">Matin — avant la pause ({regles.debutJournee}–{regles.pause.debut})</option>
                <option value="matin2">Matin — après la pause ({regles.pause.fin}–{regles.finPrimaire})</option>
                <option value="apresmidi">Après-midi ({regles.debutApresMidi}–{regles.finApresMidi})</option>
              </Select>
            )}
            <div className="grid-2 mt-4">
              <Select label="Jour" name="jour" value={form.jour_semaine} onChange={(e) => setForm({ ...form, jour_semaine: e.target.value })}>
                {JOURS_LABEL.map((j, i) => <option key={j} value={i + 1}>{j.charAt(0).toUpperCase() + j.slice(1)}</option>)}
              </Select>
              {estPrimaire ? (
                <Input label="Début (libre)" name="heure_debut" type="time" value={form.heure_debut}
                  onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
                  min={bornesPeriode(form.periode).debutMin} max={bornesPeriode(form.periode).debutMax} required
                  aide={`${bornesPeriode(form.periode).debutMin} – ${bornesPeriode(form.periode).debutMax}`} />
              ) : (
                <Select label="Heure de début" name="heure_debut" value={form.heure_debut} onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}>
                  {debuts.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              )}
            </div>
            {estPrimaire ? (
              <>
                <div className="grid-2 mt-4">
                  <Input label="Fin (libre)" name="heure_fin" type="time" value={form.heure_fin}
                    onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
                    min={bornesPeriode(form.periode).finMin} max={bornesPeriode(form.periode).finMax} required
                    aide={`Au plus tard ${bornesPeriode(form.periode).finMax}`} />
                  <Input label="Heure de fin" value={form.heure_fin} disabled />
                </div>
                <p className="text-doux" style={{ fontSize: 12 }}>
                  Au primaire, la durée n’est pas fixée : saisissez directement l’heure de fin. Cours le matin (fin {regles.finPrimaire}) et l’après-midi dès {regles.debutApresMidi}.
                </p>
              </>
            ) : (
              <div className="grid-2 mt-4">
                <Select label={`Durée (× ${duree} min)`} name="nb_heures" value={form.nb_heures} onChange={(e) => setForm({ ...form, nb_heures: e.target.value })}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} heure{n > 1 ? 's' : ''} ({n * duree} min)</option>)}
                </Select>
                <Input label="Heure de fin (calculée)" name="heure_fin" value={heureFin} disabled />
              </div>
            )}
            <div className="mt-4"><Input label="Salle (facultatif)" name="salle" value={form.salle} onChange={(e) => setForm({ ...form, salle: e.target.value })} placeholder="ex. A1" /></div>
          </form>
        </Modal>
      )}
    </>
  );
}
