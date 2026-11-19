// Emploi du temps par cycle → classe → alias (Directeur / Secrétaire — même écran partagé).
// Vue semaine (Calendar), création / déplacement (drag & drop) / suppression.
// 1 heure de cours = 55 minutes.
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

const JOURS_LABEL = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const HEURE_DEBUT_MIN = 7 * 60;
const JOURS_DND = [
  { numero: 1, label: 'Lundi' }, { numero: 2, label: 'Mardi' }, { numero: 3, label: 'Mercredi' },
  { numero: 4, label: 'Jeudi' }, { numero: 5, label: 'Vendredi' }, { numero: 6, label: 'Samedi' },
];

export default function EmploiDuTempsEspace({ espace = 'directeur' }) {
  const apiBase = espace === 'directeur' ? '/directeur' : '/secretaire';
  const toast = useToast();
  const { supprimer } = useConfirm();
  const [cycles, setCycles] = useState([]);
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
  const [form, setForm] = useState({ teacher_assignment_id: '', jour_semaine: 2, heure_debut: '08:00', nb_heures: 1, salle: '' });

  // Référentiels
  useEffect(() => {
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
    api.get('/annees-academiques/courante').then(({ data }) => setAnnee(data)).catch(() => setAnnee(null));
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
  }, [aliasId]);
  useEffect(() => { charger(); }, [charger]);

  const evenements = useMemo(() => creneaux.map((c) => ({
    id: c.id,
    jour: c.jour_semaine,
    heureDebut: String(c.heure_debut).slice(0, 5),
    heureFin: String(c.heure_fin).slice(0, 5),
    titre: `${c.matiere_nom}`,
    sousTitre: `${c.prof_prenom} ${c.prof_nom}${c.salle ? ` · Salle ${c.salle}` : ''}`,
    brut: c,
  })), [creneaux]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    setErreur('');
    setForm({ teacher_assignment_id: affectations[0]?.teacher_assignment_id || '', jour_semaine: 2, heure_debut: '08:00', nb_heures: 1, salle: '' });
    setModalOuvert(true);
  };

  const ouvrirEdition = (ev) => {
    setEnEdition(ev.brut);
    setErreur('');
    setForm({
      teacher_assignment_id: ev.brut.teacher_assignment_id,
      jour_semaine: ev.brut.jour_semaine,
      heure_debut: String(ev.brut.heure_debut).slice(0, 5),
      nb_heures: ev.brut.nb_heures,
      salle: ev.brut.salle || '',
    });
    setModalOuvert(true);
  };

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
      nb_heures: Number(form.nb_heures),
      salle: form.salle.trim() || null,
    };
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

  const heureFin = useMemo(() => {
    const [h, m] = String(form.heure_debut).split(':').map(Number);
    const fin = h * 60 + (m || 0) + Number(form.nb_heures || 1) * 55;
    return `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`;
  }, [form.heure_debut, form.nb_heures]);

  // ---- Drag & drop : déplacement d'un créneau vers un autre jour/horaire ----
  const onDragStart = (e, ev) => {
    e.dataTransfer.setData('text/plain', String(ev.id));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDropSurJour = async (e, jour, deltaMinutes) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain'));
    const creneau = creneaux.find((c) => c.id === id);
    if (!creneau) return;
    const debutTotal = HEURE_DEBUT_MIN + deltaMinutes;
    const heureDebut = `${String(Math.floor(debutTotal / 60)).padStart(2, '0')}:${String(debutTotal % 60).padStart(2, '0')}`;
    try {
      await api.put(`${apiBase}/edt/${id}`, {
        class_alias_id: creneau.class_alias_id,
        teacher_assignment_id: creneau.teacher_assignment_id,
        jour_semaine: jour,
        heure_debut: heureDebut,
        nb_heures: creneau.nb_heures,
        salle: creneau.salle || null,
      });
      toast.succes('Créneau déplacé.');
      charger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Déplacement impossible.'));
    }
  };

  return (
    <>
      <h1 className="page-titre">Emploi du temps{annee ? ` — ${annee.libelle}` : ''}</h1>
      <p className="text-doux mb-4">Créneaux de 55 minutes (ou multiples). Déplacez-les par glisser-déposer, cliquez pour modifier. Les chevauchements sont refusés (même alias, même professeur ou même salle).</p>

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

      {chargement && <div className="spinner" />}
      {!aliasId && <Card><p className="text-doux">Choisissez un cycle, une classe puis un alias pour voir son emploi du temps.</p></Card>}

      {aliasId && !chargement && (
        <CalendrierDnd evenements={evenements} onEvenementClick={ouvrirEdition} onDropSurJour={onDropSurJour} onDragStart={onDragStart} />
      )}

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
            <div className="grid-2 mt-4">
              <Select label="Jour" name="jour" value={form.jour_semaine} onChange={(e) => setForm({ ...form, jour_semaine: e.target.value })}>
                {JOURS_LABEL.map((j, i) => <option key={j} value={i + 1}>{j.charAt(0).toUpperCase() + j.slice(1)}</option>)}
              </Select>
              <Input label="Heure de début" name="heure_debut" type="time" value={form.heure_debut} onChange={(e) => setForm({ ...form, heure_debut: e.target.value })} required />
            </div>
            <div className="grid-2 mt-4">
              <Select label="Durée (× 55 min)" name="nb_heures" value={form.nb_heures} onChange={(e) => setForm({ ...form, nb_heures: e.target.value })}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} heure{n > 1 ? 's' : ''} de cours ({n * 55} min)</option>)}
              </Select>
              <Input label="Heure de fin (calculée)" name="heure_fin" value={heureFin} disabled />
            </div>
            <div className="mt-4"><Input label="Salle (facultatif)" name="salle" value={form.salle} onChange={(e) => setForm({ ...form, salle: e.target.value })} placeholder="ex. A1" /></div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ===== Calendrier avec glisser-déposer ===== */
function CalendrierDnd({ evenements, onEvenementClick, onDropSurJour, onDragStart }) {
  const JOURS = JOURS_DND;
  const TRANCHES = [];
  for (let t = HEURE_DEBUT_MIN; t < 19 * 60; t += 55) TRANCHES.push(t);
  const HAUTEUR = 48;
  const posFor = (ev) => {
    const [h, m] = ev.heureDebut.split(':').map(Number);
    const debut = h * 60 + (m || 0);
    const [hf, mf] = ev.heureFin.split(':').map(Number);
    const fin = hf * 60 + (mf || 0);
    return { top: ((debut - HEURE_DEBUT_MIN) / 55) * HAUTEUR, height: Math.max(((fin - debut) / 55) * HAUTEUR, 18) };
  };

  return (
    <div className="calendrier" role="grid" aria-label="Emploi du temps — vue semaine">
      <div className="calendrier-grille">
        <div className="calendrier-gouttiere">
          <div className="calendrier-gouttiere-entete" style={{ height: 41 }} aria-hidden="true" />
          {TRANCHES.map((t) => <div key={t} className="calendrier-gouttiere-heure">{String(Math.floor(t / 60)).padStart(2, '0')}:{String(t % 60).padStart(2, '0')}</div>)}
        </div>
        {JOURS.map((jour) => (
          <div key={jour.numero} className="calendrier-jour" role="gridcell">
            <div className="calendrier-jour-entete">{jour.label}</div>
            <div
              style={{ position: 'relative', height: TRANCHES.length * HAUTEUR }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const delta = Math.round((e.clientY - rect.top) / HAUTEUR) * 55;
                onDropSurJour(e, jour.numero, Math.max(0, Math.min(delta, (TRANCHES.length - 1) * 55)));
              }}
            >
              {TRANCHES.map((t) => <div key={t} className="calendrier-jour-fond" />)}
              {evenements.filter((ev) => ev.jour === jour.numero).map((ev) => {
                const { top, height } = posFor(ev);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    draggable
                    onDragStart={(e) => onDragStart(e, ev)}
                    onClick={() => onEvenementClick(ev)}
                    className="evenement"
                    style={{ top, height, cursor: 'grab', textAlign: 'left' }}
                    title="Glisser-déposer pour déplacer"
                  >
                    <div>{ev.titre}</div>
                    {ev.sousTitre && <div className="evenement-sous">{ev.sousTitre}</div>}
                    <div className="evenement-sous">{ev.heureDebut} – {ev.heureFin}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
