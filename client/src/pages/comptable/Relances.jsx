// Relances parents : comptes en retard, sélection multiple, envoi groupé
// (notification interne + e-mail si disponible + lien wa.me pré-rempli),
// avec historique.
import { useEffect, useMemo, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import SearchBar from '../../components/SearchBar';
import Badge from '../../components/Badge';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Textarea from '../../components/Textarea';
import Pagination from '../../components/Pagination';

export default function RelancesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [comptes, setComptes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [selection, setSelection] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);

  // Historique
  const [pageHist, setPageHist] = useState(1);
  const [parPageHist, setParPageHist] = useState(10);
  const [historique, setHistorique] = useState({ rows: [], total: 0 });
  const [chargementHist, setChargementHist] = useState(true);

  const chargerComptes = () => {
    setChargement(true);
    const params = new URLSearchParams({ parPage: '100' });
    api.get(`/comptable/comptes-en-retard?${params}`)
      .then(({ data }) => setComptes(data || []))
      .catch(() => setComptes([]))
      .finally(() => setChargement(false));
  };

  const chargerHistorique = () => {
    setChargementHist(true);
    api.get(`/comptable/relances/historique?page=${pageHist}&parPage=${parPageHist}`)
      .then(({ data }) => setHistorique(data))
      .catch(() => setHistorique({ rows: [], total: 0 }))
      .finally(() => setChargementHist(false));
  };

  useEffect(() => { chargerComptes(); }, []);
  useEffect(() => { chargerHistorique(); /* eslint-disable-next-line */ }, [pageHist, parPageHist]);

  const comptesFiltres = useMemo(() => {
    const m = search.trim().toLowerCase();
    if (!m) return comptes;
    return comptes.filter((c) => `${c.prenom} ${c.nom} ${c.matricule}`.toLowerCase().includes(m));
  }, [comptes, search]);

  const nbSelection = Object.values(selection).filter(Boolean).length;

  const toutCoche = comptesFiltres.length > 0 && comptesFiltres.every((c) => selection[c.enrollment_id]);
  const basculerTout = () => {
    const prochain = { ...selection };
    if (toutCoche) comptesFiltres.forEach((c) => { delete prochain[c.enrollment_id]; });
    else comptesFiltres.forEach((c) => { prochain[c.enrollment_id] = true; });
    setSelection(prochain);
  };

  const relancer = async () => {
    const ids = Object.entries(selection).filter(([, v]) => v).map(([k]) => Number(k));
    if (ids.length === 0) {
      toast.avertissement('Sélectionnez au moins un compte.');
      return;
    }
    setEnvoi(true);
    setResultat(null);
    try {
      const { data } = await api.post('/comptable/relances', { enrollment_ids: ids, message: message.trim() || undefined });
      setResultat(data);
      setSelection({});
      chargerComptes();
      chargerHistorique();
      toast.succes(`${data.total} parent(s) relancé(s) — ${data.notificationsCreees} notification(s), ${data.mailsEnvoyes} mail(s).`);
    } catch (err) {
      toast.erreur(messageErreur(err, 'Relance impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const CANAL_LIB = { NOTIFICATION: 'Notification', EMAIL: 'E-mail', WHATSAPP: 'WhatsApp' };
  const CANAL_COULEUR = { NOTIFICATION: 'bleu', EMAIL: 'jaune', WHATSAPP: 'vert' };

  return (
    <>
      <h1 className="page-titre">Relances parents</h1>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* ===== Comptes en retard ===== */}
        <Card titre={`Comptes avec reste à payer (${comptesFiltres.length})`}>
          <SearchBar valeur={search} onChange={setSearch} placeholder="Filtrer par nom ou matricule…" />
          <div className="mt-4">
            <Textarea label="Message personnalisé (facultatif)" name="message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Laissez vide pour utiliser le message par défaut (reste dû + modalité)." />
          </div>
          <div className="table-conteneur mt-4" style={{ maxHeight: 420 }}>
            <table className="tableau" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}><input type="checkbox" checked={toutCoche} onChange={basculerTout} aria-label="Tout sélectionner" /></th>
                  <th>Élève</th><th>Classe</th><th>Reste</th><th>Modalité</th>
                </tr>
              </thead>
              <tbody>
                {chargement ? (
                  <tr><td colSpan={5}><div className="spinner" style={{ margin: '16px auto' }} /></td></tr>
                ) : comptesFiltres.length === 0 ? (
                  <tr><td colSpan={5}><div className="etat-vide">Aucun compte avec reste à payer.</div></td></tr>
                ) : comptesFiltres.map((c) => (
                  <tr key={c.enrollment_id}>
                    <td><input type="checkbox" checked={Boolean(selection[c.enrollment_id])} onChange={(e) => setSelection((s) => ({ ...s, [c.enrollment_id]: e.target.checked }))} aria-label={`Sélectionner ${c.prenom} ${c.nom}`} /></td>
                    <td>{c.prenom} {c.nom}<br /><code style={{ fontSize: 11 }}>{c.matricule}</code></td>
                    <td>{c.classe_nom} · {c.alias_nom}</td>
                    <td><strong style={{ color: 'var(--rouge-700)' }}>{Number(c.reste).toLocaleString('fr-FR')}</strong></td>
                    <td>{c.modalite_paiement.charAt(0) + c.modalite_paiement.slice(1).toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button className="mt-4 w-100" onClick={relancer} disabled={envoi || nbSelection === 0}>
            {envoi ? 'Relance en cours…' : `Relancer la sélection (${nbSelection})`}
          </Button>
          <p className="text-doux mt-4" style={{ fontSize: 12 }}>Chaque relance crée une notification interne pour le compte parent (s’il existe), envoie un e-mail (s’il est disponible), et génère un lien WhatsApp pré-rempli.</p>
        </Card>

        {/* ===== Résultat + historique ===== */}
        <div>
          {resultat && (
            <Card titre="Relances envoyées" className="mb-4">
              <p className="text-doux">{resultat.total} parent(s) relancé(s) — {resultat.notificationsCreees} notification(s), {resultat.mailsEnvoyes} mail(s) envoyé(s).</p>
              <div className="table-conteneur mt-4" style={{ maxHeight: 260 }}>
                <table className="tableau" style={{ minWidth: 420 }}>
                  <thead><tr><th>Élève</th><th>Reste</th><th>WhatsApp</th></tr></thead>
                  <tbody>
                    {resultat.resultats.map((r) => (
                      <tr key={r.enrollment_id}>
                        <td>{r.eleve}<br /><code style={{ fontSize: 11 }}>{r.matricule}</code></td>
                        <td>{Number(r.reste).toLocaleString('fr-FR')}</td>
                        <td><a className="btn btn-success btn-sm" href={r.waLink} target="_blank" rel="noopener noreferrer">Ouvrir</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card titre="Historique des relances">
            {chargementHist ? <div className="spinner" /> : historique.rows.length === 0 ? (
              <p className="text-doux">Aucune relance enregistrée pour l’instant.</p>
            ) : (
              <>
                <div className="table-conteneur" style={{ maxHeight: 320 }}>
                  <table className="tableau" style={{ minWidth: 420 }}>
                    <thead><tr><th>Date</th><th>Élève</th><th>Canal</th><th>Statut</th></tr></thead>
                    <tbody>
                      {historique.rows.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.sent_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td>{h.prenom} {h.nom}<br /><code style={{ fontSize: 11 }}>{h.matricule}</code></td>
                          <td><Badge couleur={CANAL_COULEUR[h.canal] || 'gris'}>{CANAL_LIB[h.canal] || h.canal}</Badge></td>
                          <td><Badge couleur={h.statut === 'ENVOYE' ? 'vert' : 'rouge'}>{h.statut === 'ENVOYE' ? 'Envoyé' : 'Échec'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={pageHist} totalPages={Math.max(1, Math.ceil(historique.total / parPageHist))} total={historique.total} parPage={parPageHist} onChangePage={setPageHist} onChangeParPage={setParPageHist} />
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
