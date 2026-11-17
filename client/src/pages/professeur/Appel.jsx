// Appel avant/après chaque cours : présents / absents / retards (minutes),
// modifiable le jour même, notification aux parents pour absents/retards.
import { useEffect, useMemo, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';

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
  const [envoi, setEnvoi] = useState(false);
  const [seanceExistante, setSeanceExistante] = useState(false);

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
    setSeanceExistante(false);

    // 1) Élèves de la classe/alias — réutilise la feuille vide (id de période donnée par matière) → non : on interroge l'EDT puis la liste via /professeur/feuille ? Non dédié.
    //    → on charge les élèves inscrits dans l'alias via la fiche de la matière du créneau (feuille nécessite une période).
    //    Plus simple : via endpoint dédié : creneaux-du-jour + une vue élèves de l'alias.
    try {
      const aujourdHui = new Date().toISOString().slice(0, 10);
      const { data } = await api.get(`/professeur/appel?teacher_assignment_id=${creneau.teacher_assignment_id}&date_cours=${aujourdHui}&heure_debut=${String(creneau.heure_debut).slice(0, 5)}`);
      if (data.session) {
        setSeanceExistante(true);
        const prochainsStatuts = {};
        const prochainesMinutes = {};
        for (const r of data.records) {
          prochainsStatuts[r.enrollment_id] = r.statut;
          if (r.minutes_retard) prochainesMinutes[r.enrollment_id] = r.minutes_retard;
        }
        setStatuts(prochainsStatuts);
        setMinutes(prochainesMinutes);
        setEleves(data.records.map((r) => ({ enrollment_id: r.enrollment_id, matricule: r.matricule, nom: r.nom, prenom: r.prenom })));
        return;
      }
      // Pas de séance : charge la liste des élèves depuis la feuille de la matière (période courante)
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
    const records = eleves.map((e) => ({
      enrollment_id: e.enrollment_id,
      statut: statuts[e.enrollment_id] || 'PRESENT',
      minutes_retard: statuts[e.enrollment_id] === 'RETARD' ? Number(minutes[e.enrollment_id] || 0) : undefined,
    }));
    if (records.some((r) => r.statut === 'RETARD' && !(r.minutes_retard > 0))) {
      setErreur('Chaque retard exige un nombre de minutes supérieur à 0.');
      return;
    }
    setEnvoi(true);
    try {
      await api.post('/professeur/appel', {
        teacher_assignment_id: selection.teacher_assignment_id,
        timetable_slot_id: selection.timetable_slot_id,
        date_cours: aujourdHui,
        heure_debut: String(selection.heure_debut).slice(0, 5),
        records,
      });
      toast.succes('Appel enregistré. Les parents des absents/retardataires ont été notifiés.');
      setSeanceExistante(true);
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const compteurs = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, RETARD: 0 };
    for (const e of eleves) c[statuts[e.enrollment_id] || 'PRESENT'] += 1;
    return c;
  }, [eleves, statuts]);

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
              </div>
              <div className="table-conteneur" style={{ maxHeight: '55vh' }}>
                <table className="tableau" style={{ minWidth: 560 }}>
                  <thead>
                    <tr><th>Élève</th><th>Matricule</th><th>Statut</th><th>Minutes de retard</th></tr>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex-between mt-4" style={{ flexWrap: 'wrap', gap: 12 }}>
                <span className="text-doux" style={{ fontSize: 13 }}>Chaque absence ou retard notifie automatiquement le parent de l’élève.</span>
                <Button onClick={enregistrer} disabled={envoi || eleves.length === 0}>{envoi ? 'Enregistrement…' : 'Enregistrer l’appel'}</Button>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
