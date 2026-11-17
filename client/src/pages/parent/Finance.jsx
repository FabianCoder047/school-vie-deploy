// Situation financière de l'enfant — consultation en lecture seule.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { messageErreur } from '../../api/axios';
import { useEnfants, EnfantSelect } from './useEnfants.jsx';
import Badge from '../../components/Badge';
import Card from '../../components/Card';

const MOYEN_LIB = { ESPECES: 'Espèces', FLOOZ: 'Flooz', MIXX_BY_YAS: 'Mixx By Yas' };
const STATUT_SCOLARITE = {
  SOLDE: { couleur: 'vert', label: 'Soldé' },
  A_JOUR: { couleur: 'bleu', label: 'À jour' },
  EN_RETARD: { couleur: 'rouge', label: 'En retard' },
};

export default function SituationFinancierePage() {
  const { enfants, enfantId, setEnfantId, enfantSelectionne, chargement } = useEnfants();
  const [searchParams] = useSearchParams();
  const [situation, setSituation] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargementSituation, setChargementSituation] = useState(false);

  useEffect(() => {
    const id = Number(searchParams.get('enfant'));
    if (id && enfants.some((e) => e.enrollment_id === id)) setEnfantId(id);
  }, [searchParams, enfants, setEnfantId]);

  useEffect(() => {
    if (!enfantId) { setSituation(null); return; }
    setChargementSituation(true);
    setErreur('');
    api.get(`/parent/finance/${enfantId}`)
      .then(({ data }) => setSituation(data))
      .catch((err) => setErreur(messageErreur(err, 'Impossible de charger la situation financière.')))
      .finally(() => setChargementSituation(false));
  }, [enfantId]);

  if (chargement) return (<><h1 className="page-titre">Situation financière</h1><div className="spinner" /></>);
  if (enfants.length === 0) {
    return (<><h1 className="page-titre">Situation financière</h1><Card><p className="text-doux">Aucun enfant inscrit cette année.</p></Card></>);
  }

  const s = situation;
  return (
    <>
      <h1 className="page-titre">Situation financière</h1>
      <div className="flex-between mb-4"><span /><EnfantSelect enfants={enfants} enfantId={enfantId} onChange={setEnfantId} /></div>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}
      {chargementSituation || !s ? <div className="spinner" /> : (
        <>
          {/* ===== Synthèse ===== */}
          <div className="grid-4 mb-4">
            <div className="stat-card"><div><div className="stat-card-label">Scolarité annuelle</div><div className="stat-card-valeur" style={{ fontSize: 19 }}>{Number(s.total_du).toLocaleString('fr-FR')} FCFA</div><div className="stat-card-detail">{s.fiche?.modalite_paiement}</div></div></div>
            <div className="stat-card"><div><div className="stat-card-label">Payé</div><div className="stat-card-valeur" style={{ fontSize: 19 }}>{Number(s.total_paye).toLocaleString('fr-FR')} FCFA</div><div className="stat-card-detail">inscription : {s.paiementInscription ? 'réglée' : 'non réglée'}</div></div></div>
            <div className="stat-card"><div><div className="stat-card-label">Reste à payer</div><div className="stat-card-valeur" style={{ fontSize: 19, color: Number(s.reste) > 0 ? 'var(--rouge-700)' : 'var(--vert-700)' }}>{Number(s.reste).toLocaleString('fr-FR')} FCFA</div></div></div>
            <div className="stat-card"><div><div className="stat-card-label">Statut</div><div className="stat-card-valeur" style={{ fontSize: 19 }}><Badge couleur={(STATUT_SCOLARITE[s.statut_scolarite] || {}).couleur || 'gris'}>{(STATUT_SCOLARITE[s.statut_scolarite] || {}).label || s.statut_scolarite}</Badge></div></div></div>
          </div>

          {/* ===== Échéancier ===== */}
          <p className="sidebar-section mb-4" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px' }}>Échéancier ({s.echeances.length} échéance{s.echeances.length > 1 ? 's' : ''})</p>
          <div className="table-conteneur mb-4" style={{ maxHeight: 320 }}>
            <table className="tableau" style={{ minWidth: 520 }}>
              <thead><tr><th>#</th><th>Échéance</th><th>Dû</th><th>Payé</th><th>Statut</th></tr></thead>
              <tbody>
                {s.echeances.map((e) => (
                  <tr key={e.numero}>
                    <td>{e.numero}</td>
                    <td>{new Date(e.date_echeance).toLocaleDateString('fr-FR')}</td>
                    <td>{Number(e.montant_du).toLocaleString('fr-FR')}</td>
                    <td>{Number(e.montant_paye).toLocaleString('fr-FR')}</td>
                    <td><Badge couleur={e.statut === 'PAYE' ? 'vert' : e.statut === 'PARTIEL' ? 'jaune' : 'gris'}>{e.statut === 'PAYE' ? 'Payé' : e.statut === 'PARTIEL' ? 'Partiel' : 'À payer'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ===== Paiements ===== */}
          <p className="sidebar-section mb-4" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px' }}>Paiements ({s.payments.length})</p>
          {s.payments.length === 0 ? (
            <p className="text-doux">Aucun paiement enregistré pour cet élève.</p>
          ) : (
            <div className="table-conteneur" style={{ maxHeight: 260 }}>
              <table className="tableau" style={{ minWidth: 520 }}>
                <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Moyen</th><th>Reçu</th><th>Statut</th></tr></thead>
                <tbody>
                  {s.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                      <td>{p.type === 'INSCRIPTION' ? 'Inscription' : 'Scolarité'}</td>
                      <td>{Number(p.montant).toLocaleString('fr-FR')}</td>
                      <td>{MOYEN_LIB[p.moyen] || p.moyen}</td>
                      <td><code>{p.numero_recu}</code></td>
                      <td><Badge couleur={p.statut === 'VALIDE' ? 'vert' : 'rouge'}>{p.statut === 'VALIDE' ? 'Validé' : 'Annulé'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
