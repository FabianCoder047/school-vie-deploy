// Absences de mes enfants — le parent voit les absences/retards signalés
// et peut renseigner le motif de chaque absence (communiqué à l'école,
// utilisable lors du conseil de discipline).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { messageErreur } from '../../api/axios';
import { useEnfants, EnfantSelect } from './useEnfants.jsx';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Textarea from '../../components/Textarea';

const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

export default function AbsencesPage() {
  const toast = useToast();
  const { confirmer } = useConfirm();
  const { enfants, enfantId, setEnfantId, enfantSelectionne, chargement } = useEnfants();
  const [searchParams] = useSearchParams();
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargementListe, setChargementListe] = useState(false);
  const [absenceAjustifier, setAbsenceAjustifier] = useState(null); // record en cours d'édition
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreurMotif, setErreurMotif] = useState('');

  // Pré-sélection via ?enfant=<id>
  useEffect(() => {
    const id = Number(searchParams.get('enfant'));
    if (id && enfants.some((e) => e.enrollment_id === id)) setEnfantId(id);
  }, [searchParams, enfants, setEnfantId]);

  useEffect(() => {
    if (!enfantId) { setDonnees(null); return; }
    setChargementListe(true);
    setErreur('');
    api.get(`/parent/absences/${enfantId}`)
      .then(({ data }) => setDonnees(data))
      .catch((err) => setErreur(messageErreur(err, 'Impossible de charger les absences.')))
      .finally(() => setChargementListe(false));
  }, [enfantId]);

  const ouvrirMotif = (absence) => {
    setAbsenceAjustifier(absence);
    setMotif(absence.justification ?? '');
    setErreurMotif('');
  };

  const enregistrerMotif = async () => {
    const texte = motif.trim();
    if (texte.length < 3) { setErreurMotif('Le motif doit contenir au moins 3 caractères.'); return; }
    setEnvoi(true);
    setErreurMotif('');
    try {
      await api.post(`/parent/absences/${absenceAjustifier.id}/motif`, { motif: texte });
      toast.succes('Motif envoyé à l’école.');
      setAbsenceAjustifier(null);
      // Recharge la liste
      const { data } = await api.get(`/parent/absences/${enfantId}`);
      setDonnees(data);
    } catch (err) {
      setErreurMotif(messageErreur(err, 'Envoi impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const retirerMotif = async (absence) => {
    const ok = await confirmer({
      titre: 'Retirer le motif',
      message: 'Retirer le motif que vous avez envoyé ? L’absence redeviendra « non justifiée ».',
      type: 'danger',
      texteConfirmer: 'Retirer',
    });
    if (!ok) return;
    try {
      await api.delete(`/parent/absences/${absence.id}/motif`);
      toast.succes('Motif retiré.');
      const { data } = await api.get(`/parent/absences/${enfantId}`);
      setDonnees(data);
    } catch (err) {
      setErreur(messageErreur(err, 'Suppression impossible.'));
    }
  };

  if (chargement) return (<><h1 className="page-titre">Absences & motifs</h1><div className="spinner" /></>);
  if (enfants.length === 0) {
    return (<><h1 className="page-titre">Absences & motifs</h1><Card><p className="text-doux">Aucun enfant inscrit cette année.</p></Card></>);
  }

  const summary = donnees?.summary;
  return (
    <>
      <h1 className="page-titre">Absences & motifs</h1>
      <div className="flex-between mb-4"><span /><EnfantSelect enfants={enfants} enfantId={enfantId} onChange={setEnfantId} /></div>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      <Card className="mb-4">
        <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          {enfantSelectionne && (
            <>
              <div>
                <div style={{ fontSize: 12, color: 'var(--texte-doux)', textTransform: 'uppercase', fontWeight: 700 }}>Élève</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{enfantSelectionne.prenom} {enfantSelectionne.nom}</div>
                <div className="text-doux" style={{ fontSize: 12 }}>{enfantSelectionne.matricule} — {enfantSelectionne.classe_nom} · {enfantSelectionne.alias_nom}</div>
              </div>
              {summary && (
                <div className="flex gap-2" style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>
                  <Badge couleur="rouge">{summary.absences} absence{summary.absences > 1 ? 's' : ''}</Badge>
                  <Badge couleur="vert">{summary.absencesJustifiees} justifiée{summary.absencesJustifiees > 1 ? 's' : ''}</Badge>
                  <Badge couleur="jaune">{summary.absencesNonJustifiees} non justifiée{summary.absencesNonJustifiees > 1 ? 's' : ''}</Badge>
                  <Badge couleur="gris">{summary.retards} retard{summary.retards > 1 ? 's' : ''}</Badge>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {chargementListe && <div className="spinner" />}
      {donnees && donnees.absences.length === 0 && (
        <Card><p className="text-doux">Aucune absence ni retard signalé pour cet élève.</p></Card>
      )}
      {donnees && donnees.absences.length > 0 && (
        <div className="table-conteneur">
          <table className="tableau" style={{ minWidth: 720 }}>
            <thead>
              <tr><th>Date</th><th>Séance</th><th>Matière</th><th>Type</th><th>Justification</th><th style={{ width: 150 }}>Action</th></tr>
            </thead>
            <tbody>
              {donnees.absences.map((a) => {
                const justifiee = a.justification_statut === 'JUSTIFIEE';
                const parProf = a.justification_par === 'PROFESSEUR';
                return (
                  <tr key={a.id}>
                    <td>{dateFr(a.date_cours)}</td>
                    <td>{a.heure_debut ? String(a.heure_debut).slice(0, 5) : '—'}</td>
                    <td>{a.matiere_nom}</td>
                    <td>
                      {a.statut === 'ABSENT'
                        ? <Badge couleur="rouge">Absence</Badge>
                        : <Badge couleur="jaune">Retard {a.minutes_retard} min</Badge>}
                    </td>
                    <td>
                      {justifiee ? (
                        <>
                          <Badge couleur="vert">Justifiée{parProf ? ' (professeur)' : ''}</Badge>
                          {a.justification && <div style={{ fontSize: 12, marginTop: 4 }}>« {a.justification} »</div>}
                        </>
                      ) : (
                        <>
                          <Badge couleur="gris">Non justifiée</Badge>
                          <div className="text-doux" style={{ fontSize: 11, marginTop: 4 }}>Un motif peut être envoyé à l’école.</div>
                        </>
                      )}
                    </td>
                    <td>
                      {parProf ? (
                        <span className="text-doux" style={{ fontSize: 12 }}>Justifiée par le professeur</span>
                      ) : (
                        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => ouvrirMotif(a)}>
                            {justifiee ? 'Modifier le motif' : 'Envoyer un motif'}
                          </button>
                          {justifiee && (
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => retirerMotif(a)}>Retirer</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Modale motif ===== */}
      {absenceAjustifier && (
        <Modal
          titre={absenceAjustifier.statut === 'ABSENT' ? 'Motif de l’absence' : 'Motif du retard'}
          onFermer={() => setAbsenceAjustifier(null)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setAbsenceAjustifier(null)}>Annuler</Button>
              <Button onClick={enregistrerMotif} disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer à l’école'}</Button>
            </>
          )}
        >
          <p className="text-doux" style={{ marginTop: 0 }}>
            {dateFr(absenceAjustifier.date_cours)}{absenceAjustifier.heure_debut ? ` · ${String(absenceAjustifier.heure_debut).slice(0, 5)}` : ''} — {absenceAjustifier.matiere_nom}
          </p>
          <div className="alert alert-warning" role="alert" style={{ background: '#fffbeb', border: '1px solid #f59e0b', color: '#92400e', borderRadius: 'var(--rayon-sm)', padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>
            <strong>Important :</strong> ce motif sera communiqué au professeur et à la direction de l’école, et pourra être utilisé lors du <strong>conseil de discipline</strong>.
          </div>
          {erreurMotif && <div className="auth-erreur mb-4" role="alert">{erreurMotif}</div>}
          <Textarea
            label="Votre motif"
            name="motif"
            rows={4}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : Maladie — certificat médical joint / Convocation administrative / Décès d’un parent…"
            maxLength={500}
            autoFocus
          />
          <div className="text-doux" style={{ fontSize: 11, textAlign: 'right' }}>{motif.length}/500</div>
        </Modal>
      )}
    </>
  );
}
