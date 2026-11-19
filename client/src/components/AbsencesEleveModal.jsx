// Détail des absences/retards d'un élève — utilisé par le Directeur
// (base /directeur) et le Professeur (base /professeur, élève de ses classes).
import { useEffect, useState } from 'react';
import api, { messageErreur } from '../api/axios';
import Modal from './Modal';
import Badge from './Badge';

const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

export default function AbsencesEleveModal({ endpoint, titre, onFermer }) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!endpoint) return;
    setDonnees(null);
    setErreur('');
    api.get(endpoint)
      .then(({ data }) => setDonnees(data))
      .catch((err) => setErreur(messageErreur(err, 'Impossible de charger le détail des absences.')));
  }, [endpoint]);

  const summary = donnees?.summary;
  return (
    <Modal titre={titre || 'Absences de l’élève'} onFermer={onFermer} taille="lg">
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}
      {!donnees && !erreur ? (
        <div className="spinner" />
      ) : donnees ? (
        <>
          <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
            <Badge couleur="rouge">{summary.absences} absence{summary.absences > 1 ? 's' : ''}</Badge>
            <Badge couleur="vert">{summary.absencesJustifiees} justifiée{summary.absencesJustifiees > 1 ? 's' : ''}</Badge>
            <Badge couleur="jaune">{summary.absencesNonJustifiees} non justifiée{summary.absencesNonJustifiees > 1 ? 's' : ''}</Badge>
            <Badge couleur="gris">{summary.retards} retard{summary.retards > 1 ? 's' : ''} ({summary.retardMinutes} min)</Badge>
          </div>
          {donnees.absences.length === 0 ? (
            <p className="text-doux">Aucune absence ni retard enregistré pour cet élève.</p>
          ) : (
            <div className="table-conteneur">
              <table className="tableau" style={{ minWidth: 640 }}>
                <thead>
                  <tr><th>Date</th><th>Séance</th><th>Matière</th><th>Type</th><th>Justification</th></tr>
                </thead>
                <tbody>
                  {donnees.absences.map((a) => (
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
                        {a.justification_statut === 'JUSTIFIEE' ? (
                          <>
                            <Badge couleur="vert">Justifiée</Badge>
                            {a.justification && <div style={{ fontSize: 12, marginTop: 4 }}>« {a.justification} »</div>}
                            <div className="text-doux" style={{ fontSize: 11 }}>
                              {a.justification_par === 'PARENT' ? 'Motif du parent' : 'Note du professeur'}
                              {a.justification_at ? ` · ${new Date(a.justification_at).toLocaleDateString('fr-FR')}` : ''}
                            </div>
                          </>
                        ) : (
                          <Badge couleur="gris">Non justifiée</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </Modal>
  );
}
