// Appel avant/après chaque cours : présents / absents / retards (minutes),
// modifiable le jour même, notification aux parents pour absents/retards.
import { useEffect, useMemo, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export default function AppelPage() {
  const toast = useToast();
  const [creneaux, setCreneaux] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [selection, setSelection] = useState(null); // { timetable_slot_id, teacher_assignment_id, ... }
  const [eleves, setEleves] = useState([]);        // [{ enrollment_id, matricule, nom, prenom }]
  const [statuts, setStatuts] = useState({});      // enrollmentId -> 'PRESENT'|'ABSENT'|'RETARD'
  const [minutes, setMinutes] = useState({});      // enrollmentId -> minutes de retard
  const [justifStatuts, setJustifStatuts] = useState({}); // enrollmentId -> 'JUSTIFIEE'|'NON_JUSTIFIEE'
  const [justifNotes, setJustifNotes] = useState({});     // enrollmentId -> motif (parent) / note (prof)
  const [justifPar, setJustifPar] = useState({});         // enrollmentId -> 'PARENT'|'PROFESSEUR'|null
  const [envoi, setEnvoi] = useState(false);
  const [seanceExistante, setSeanceExistante] = useState(false);
  const [waLiens, setWaLiens] = useState([]);   // liens wa.me pré-remplis pour les NOUVEAUX absents/retards

  useEffect(() => {
    api.get('/professeur/creneaux-du-jour')
      .then(({ data }) => { setCreneaux(data || []); if (data.length > 0) choisirCreneau(data[0]); })
      .catch((err) => setErreur(messageErreur(err, 'Chargement impossible.')))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choisirCreneau = async (creneau) => {
    setSelection(creneau);
    setErreur('');
    setEleves([]);
    setStatuts({});
    setMinutes({});
    setJustifStatuts({});
    setJustifNotes({});
    setJustifPar({});
    setSeanceExistante(false);
    setWaLiens([]);

    // 1) Séance déjà enregistrée aujourd'hui ? (charge ses records, justifications comprises)
    //    Sinon, on pré-remplit tous les élèves de l'alias (présents, non justifiés).
    try {
      const aujourdHui = new Date().toISOString().slice(0, 10);
      const { data } = await api.get(`/professeur/appel?teacher_assignment_id=${creneau.teacher_assignment_id}&date_cours=${aujourdHui}&heure_debut=${String(creneau.heure_debut).slice(0, 5)}`);
      if (data.session) {
        setSeanceExistante(true);
        const prochainsStatuts = {};
        const prochainesMinutes = {};
        const prochainesJustifs = {};
        const prochainesNotes = {};
        const prochainsPar = {};
        for (const r of data.records) {
          prochainsStatuts[r.enrollment_id] = r.statut;
          if (r.minutes_retard) prochainesMinutes[r.enrollment_id] = r.minutes_retard;
          prochainesJustifs[r.enrollment_id] = r.justification_statut === 'JUSTIFIEE' ? 'JUSTIFIEE' : 'NON_JUSTIFIEE';
          prochainesNotes[r.enrollment_id] = r.justification ?? '';
          prochainsPar[r.enrollment_id] = r.justification_par ?? null;
        }
        setStatuts(prochainsStatuts);
        setMinutes(prochainesMinutes);
        setJustifStatuts(prochainesJustifs);
        setJustifNotes(prochainesNotes);
        setJustifPar(prochainsPar);
        setEleves(data.records.map((r) => ({ enrollment_id: r.enrollment_id, matricule: r.matricule, nom: r.nom, prenom: r.prenom })));
        return;
      }
      // Pas de séance : tous les élèves sont présumés présents, non justifiés.
      await chargerElevesDepuisFeuille(creneau);
    } catch {
      await chargerElevesDepuisFeuille(creneau);
    }
  };

  const chargerElevesDepuisFeuille = async (creneau) => {
    // Pas de séance existante : charge la liste des élèves inscrits dans l'alias.
    try {
      const { data } = await api.get(`/professeur/eleves-alias?class_alias_id=${creneau.alias_id}`);
      setEleves(data || []);
      setStatuts(Object.fromEntries((data || []).map((l) => [l.enrollment_id, 'PRESENT'])));
    } catch {
      setEleves([]);
    }
  };

  const enregistrer = async () => {
    if (!selection) return;
    setErreur('');
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const records = eleves.map((e) => {
      const statut = statuts[e.enrollment_id] || 'PRESENT';
      const rec = {
        enrollment_id: e.enrollment_id,
        statut,
        minutes_retard: statut === 'RETARD' ? Number(minutes[e.enrollment_id] || 0) : undefined,
      };
      if (statut !== 'PRESENT') {
        rec.justification_statut = justifStatuts[e.enrollment_id] || 'NON_JUSTIFIEE';
        rec.justification_note = (justifNotes[e.enrollment_id] || '').trim() || null;
      }
      return rec;
    });
    if (records.some((r) => r.statut === 'RETARD' && !(r.minutes_retard > 0))) {
      setErreur('Chaque retard exige un nombre de minutes supérieur à 0.');
      return;
    }
    setEnvoi(true);
    try {
      const { data } = await api.post('/professeur/appel', {
        teacher_assignment_id: selection.teacher_assignment_id,
        timetable_slot_id: selection.timetable_slot_id,
        date_cours: aujourdHui,
        heure_debut: String(selection.heure_debut).slice(0, 5),
        records,
      });
      setSeanceExistante(true);
      setWaLiens(data?.wa || []);
      toast.succes(data?.wa?.length
        ? `Appel enregistré — ${data.wa.length} parent(s) à notifier par WhatsApp.`
        : 'Appel enregistré.');
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const toggleJustif = (enrollmentId) => {
    setJustifStatuts((s) => ({ ...s, [enrollmentId]: s[enrollmentId] === 'JUSTIFIEE' ? 'NON_JUSTIFIEE' : 'JUSTIFIEE' }));
  };

  const compteurs = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, RETARD: 0, JUSTIFIEES: 0 };
    for (const e of eleves) {
      const statut = statuts[e.enrollment_id] || 'PRESENT';
      c[statut] += 1;
      if (statut !== 'PRESENT' && justifStatuts[e.enrollment_id] === 'JUSTIFIEE') c.JUSTIFIEES += 1;
    }
    return c;
  }, [eleves, statuts, justifStatuts]);

  if (chargement) return (<><h1 className="page-titre">Appel</h1><div className="spinner" /></>);

  const today = new Date();
  return (
    <>
      <h1 className="page-titre">Appel — {JOURS[today.getDay()]} {today.toLocaleDateString('fr-FR')}</h1>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      {creneaux.length === 0 ? (
        <Card><p className="text-doux">Aucun cours planifié aujourd’hui pour vous.</p></Card>
      ) : (
        <>
          {/* ===== Choix du créneau ===== */}
          <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
            {creneaux.map((c) => (
              <button
                key={c.timetable_slot_id}
                type="button"
                onClick={() => choisirCreneau(c)}
                className={`card ${selection?.timetable_slot_id === c.timetable_slot_id ? 'actif' : ''}`}
                style={{ cursor: 'pointer', border: selection?.timetable_slot_id === c.timetable_slot_id ? '2px solid var(--bleu-600)' : '1px solid var(--bordure)', textAlign: 'left', minWidth: 240 }}
              >
                <div className="stat-card-label">{String(c.heure_debut).slice(0, 5)} – {String(c.heure_fin).slice(0, 5)}{c.salle ? ` · Salle ${c.salle}` : ''}</div>
                <div style={{ fontWeight: 800 }}>{c.matiere_nom}</div>
                <div className="text-doux">{c.classe_nom} · {c.alias_nom}</div>
              </button>
            ))}
          </div>

          {selection && (
            <Card titre={`Élèves — ${selection.matiere_nom} · ${selection.classe_nom} ${selection.alias_nom}${seanceExistante ? ' (séance déjà enregistrée aujourd’hui — modifiable)' : ''}`}>
              <div className="flex gap-3 mb-4">
                <Badge couleur="vert">{compteurs.PRESENT} présent(s)</Badge>
                <Badge couleur="rouge">{compteurs.ABSENT} absent(s)</Badge>
                <Badge couleur="jaune">{compteurs.RETARD} en retard</Badge>
                {compteurs.JUSTIFIEES > 0 && <Badge couleur="vert">{compteurs.JUSTIFIEES} justifiée{compteurs.JUSTIFIEES > 1 ? 's' : ''}</Badge>}
              </div>
              <div className="table-conteneur" style={{ maxHeight: '55vh' }}>
                <table className="tableau" style={{ minWidth: 820 }}>
                  <thead>
                    <tr><th>Élève</th><th>Matricule</th><th>Statut</th><th>Minutes de retard</th><th>Justifier (optionnel)</th></tr>
                  </thead>
                  <tbody>
                    {eleves.map((e) => {
                      const statut = statuts[e.enrollment_id] || 'PRESENT';
                      return (
                        <tr key={e.enrollment_id}>
                          <td><strong>{e.nom}</strong> {e.prenom}</td>
                          <td><code style={{ fontSize: 12 }}>{e.matricule}</code></td>
                          <td>
                            <div className="flex gap-2">
                              {[
                                { code: 'PRESENT', label: 'Présent', classe: 'btn btn-success btn-sm' },
                                { code: 'ABSENT', label: 'Absent', classe: 'btn btn-danger btn-sm' },
                                { code: 'RETARD', label: 'Retard', classe: 'btn btn-warning btn-sm' },
                              ].map((opt) => (
                                <button
                                  key={opt.code}
                                  type="button"
                                  onClick={() => setStatuts((s) => ({ ...s, [e.enrollment_id]: opt.code }))}
                                  className={opt.classe}
                                  style={statut !== opt.code ? { opacity: 0.4 } : undefined}
                                  aria-pressed={statut === opt.code}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td>
                            {statut === 'RETARD' && (
                              <input
                                type="number"
                                min="1"
                                max="240"
                                placeholder="min"
                                value={minutes[e.enrollment_id] ?? ''}
                                onChange={(ev) => setMinutes((m) => ({ ...m, [e.enrollment_id]: ev.target.value }))}
                                style={{ width: 80, padding: '7px 9px', border: '1px solid var(--bordure)', borderRadius: 'var(--rayon-sm)' }}
                                aria-label={`Minutes de retard de ${e.prenom} ${e.nom}`}
                              />
                            )}
                          </td>
                          <td>
                            {statut !== 'PRESENT' ? (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => toggleJustif(e.enrollment_id)}
                                  className={justifStatuts[e.enrollment_id] === 'JUSTIFIEE' ? 'btn btn-warning btn-sm' : 'btn btn-outline btn-sm'}
                                  aria-pressed={justifStatuts[e.enrollment_id] === 'JUSTIFIEE'}
                                >
                                  {justifStatuts[e.enrollment_id] === 'JUSTIFIEE' ? '✓ Justifiée' : 'Marquer justifiée'}
                                </button>
                                {justifStatuts[e.enrollment_id] === 'JUSTIFIEE' && (
                                  <>
                                    <input
                                      type="text"
                                      value={justifNotes[e.enrollment_id] ?? ''}
                                      onChange={(ev) => setJustifNotes((m) => ({ ...m, [e.enrollment_id]: ev.target.value }))}
                                      placeholder="Motif / note (facultatif)"
                                      maxLength={500}
                                      style={{ width: '100%', marginTop: 6, padding: '7px 9px', border: '1px solid var(--bordure)', borderRadius: 'var(--rayon-sm)' }}
                                      aria-label={`Motif de l’absence de ${e.prenom} ${e.nom}`}
                                    />
                                    {justifPar[e.enrollment_id] === 'PARENT' && (
                                      <div className="text-doux" style={{ fontSize: 11, marginTop: 3 }}>Motif envoyé par le parent</div>
                                    )}
                                    {justifPar[e.enrollment_id] === 'PROFESSEUR' && (
                                      <div className="text-doux" style={{ fontSize: 11, marginTop: 3 }}>Justifiée par le professeur</div>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : <span className="text-doux">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex-between mt-4" style={{ flexWrap: 'wrap', gap: 12 }}>
                <span className="text-doux" style={{ fontSize: 13 }}>Chaque absence ou retard notifie le parent (notification interne) et prépare un message WhatsApp pré-rempli. Marquez « justifiée » si l’élève a présenté un motif (le motif du parent est conservé même si l’appel est modifié).</span>
                <Button onClick={enregistrer} disabled={envoi || eleves.length === 0}>{envoi ? 'Enregistrement…' : 'Enregistrer l’appel'}</Button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ===== Notifier les parents par WhatsApp (liens wa.me, envoi manuel) ===== */}
      {waLiens.length > 0 && (
        <Modal titre="Notifier les parents par WhatsApp" onFermer={() => setWaLiens([])} taille="lg"
          footer={<Button variant="secondary" onClick={() => setWaLiens([])}>Fermer</Button>}>
          <p className="text-doux">L’envoi est manuel : chaque bouton ouvre WhatsApp avec le message pré-rempli — il ne reste qu’à appuyer sur <strong>Envoyer</strong>. Valable aussi pour les tuteurs sans compte School Vie. Le parent peut ensuite répondre dans l’application (Absences &amp; motifs) s’il y a un motif.</p>
          <div className="table-conteneur mt-4" style={{ maxHeight: 420 }}>
            <table className="tableau" style={{ minWidth: 480 }}>
              <thead>
                <tr><th>Élève</th><th>Matricule</th><th>Motif</th><th>WhatsApp</th></tr>
              </thead>
              <tbody>
                {waLiens.map((w) => (
                  <tr key={w.enrollment_id}>
                    <td><strong>{w.eleve}</strong></td>
                    <td><code style={{ fontSize: 11 }}>{w.matricule}</code></td>
                    <td><Badge couleur={w.type === 'ABSENCE' ? 'rouge' : 'jaune'}>{w.type === 'ABSENCE' ? 'Absence' : 'Retard'}</Badge></td>
                    <td><a className="btn btn-success btn-sm" href={w.waLink} target="_blank" rel="noopener noreferrer">Ouvrir WhatsApp</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}
