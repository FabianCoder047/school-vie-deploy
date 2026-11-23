// Enregistrer un paiement de scolarité : rechercher l'élève, voir sa
// situation, encaisser (ventilation automatique) ; le reçu est rempli à la
// main et scanné ensuite (preuve PDF/photo) — l'app ne génère pas de PDF de reçu.
import { useEffect, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import SearchBar from '../../components/SearchBar';
import Badge from '../../components/Badge';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Select from '../../components/Select';
import UploadPreuveRecu from '../../components/UploadPreuveRecu';

const MOYEN_LIB = { ESPECES: 'Espèces', FLOOZ: 'Flooz', MIXX_BY_YAS: 'Mixx By Yas' };
const STATUT_SCOLARITE = {
  SOLDE: { couleur: 'vert', label: 'Soldé' },
  A_JOUR: { couleur: 'bleu', label: 'À jour' },
  EN_RETARD: { couleur: 'rouge', label: 'En retard' },
};

export default function PaiementsPage({ base = '/comptable' }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [resultats, setResultats] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [selection, setSelection] = useState(null); // compte choisi
  const [situation, setSituation] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [dernierPaiement, setDernierPaiement] = useState(null);
  const [form, setForm] = useState({ montant: '', moyen: 'ESPECES', reference_transaction: '', date_paiement: '' });

  useEffect(() => {
    if (search.trim().length < 2) { setResultats([]); return; }
    let actif = true;
    setChargement(true);
    const timer = window.setTimeout(() => {
      api.get(`${base}/comptes?search=${encodeURIComponent(search.trim())}&parPage=8`)
        .then(({ data }) => { if (actif) setResultats(data.rows || []); })
        .catch(() => { if (actif) setResultats([]); })
        .finally(() => actif && setChargement(false));
    }, 300);
    return () => { actif = false; window.clearTimeout(timer); };
  }, [search, base]);

  const choisir = (compte) => {
    setSelection(compte);
    setDernierPaiement(null);
    setForm({ montant: '', moyen: 'ESPECES', reference_transaction: '', date_paiement: '' });
    setErreur('');
    setSituation(null);
    api.get(`${base}/comptes/${compte.enrollment_id}/situation`).then(({ data }) => setSituation(data)).catch(() => setSituation(null));
  };

  const payer = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const montant = Number(String(form.montant).replace(',', '.'));
      if (!(montant > 0)) { setErreur('Le montant doit être strictement positif.'); setEnvoi(false); return; }
      const { data } = await api.post(`${base}/paiements`, {
        enrollment_id: selection.enrollment_id,
        montant,
        moyen: form.moyen,
        reference_transaction: form.reference_transaction.trim() || null,
        date_paiement: form.date_paiement || undefined,
      });
      setSituation(data);
      setDernierPaiement(data.paiement || null);
      setForm({ montant: '', moyen: 'ESPECES', reference_transaction: '', date_paiement: '' });
      toast.succes('Paiement enregistré et ventilé sur les échéances.');
    } catch (err) {
      setErreur(messageErreur(err, 'Paiement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const [annulerId, setAnnulerId] = useState(null);
  const [motif, setMotif] = useState('');
  const [annulationEnCours, setAnnulationEnCours] = useState(false);

  const ouvrirAnnulation = () => {
    if (!dernierPaiement) return;
    setMotif('');
    setAnnulerId(dernierPaiement.id);
  };

  const confirmerAnnulation = async (e) => {
    e.preventDefault();
    if (motif.trim().length < 3) {
      setErreur('Un motif d’au moins 3 caractères est requis.');
      return;
    }
    setAnnulationEnCours(true);
    try {
      await api.post(`${base}/paiements/${annulerId}/annuler`, { motif: motif.trim() });
      toast.succes('Paiement annulé et ventilation restituée.');
      setDernierPaiement(null);
      setAnnulerId(null);
      const { data } = await api.get(`${base}/comptes/${selection.enrollment_id}/situation`);
      setSituation(data);
    } catch (err) {
      setErreur(messageErreur(err, 'Annulation impossible.'));
    } finally {
      setAnnulationEnCours(false);
    }
  };

  return (
    <>
      <h1 className="page-titre">Paiements de scolarité</h1>

      <Card titre="Rechercher un élève" className="mb-4">
        <SearchBar valeur={search} onChange={setSearch} placeholder="Nom, prénom ou matricule (2 caractères min.)…" debounceMs={250} />
        {chargement && <div className="spinner mt-4" />}
        {resultats.length > 0 && (
          <div className="table-conteneur mt-4" style={{ maxHeight: 240 }}>
            <table className="tableau" style={{ minWidth: 560 }}>
              <thead><tr><th>Matricule</th><th>Élève</th><th>Classe</th><th>Reste</th><th></th></tr></thead>
              <tbody>
                {resultats.map((r) => (
                  <tr key={r.enrollment_id}>
                    <td><code>{r.matricule}</code></td>
                    <td>{r.prenom} {r.nom}</td>
                    <td>{r.classe_nom} · {r.alias_nom}</td>
                    <td>{Number(r.reste).toLocaleString('fr-FR')} FCFA</td>
                    <td style={{ textAlign: 'right' }}><Button size="sm" onClick={() => choisir(r)}>Choisir</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal d'annulation (jamais de prompt() natif) */}
      {annulerId && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Annuler le paiement {dernierPaiement?.numero_recu}</h3><button type="button" className="modal-fermer" onClick={() => setAnnulerId(null)} aria-label="Fermer">✕</button></div>
            <form onSubmit={confirmerAnnulation}>
              <div className="modal-body">
                <p className="text-doux mb-4">Le paiement sera marqué ANNULÉ (jamais supprimé), sa ventilation sur les échéances sera restituée, et la trace sera écrite dans l’audit. Un motif est obligatoire.</p>
                <Input label="Motif de l’annulation" name="motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="ex. Erreur de saisie du moyen" requis autoFocus />
              </div>
              <div className="modal-footer">
                <Button variant="secondary" type="button" onClick={() => setAnnulerId(null)}>Garder le paiement</Button>
                <Button type="submit" variant="danger" disabled={annulationEnCours || motif.trim().length < 3}>{annulationEnCours ? 'Annulation…' : 'Annuler le paiement'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selection && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* ===== Situation de l'élève ===== */}
          <Card titre={`${situation?.fiche?.prenom || selection.prenom} ${situation?.fiche?.nom || selection.nom} — ${selection.classe_nom} · ${selection.alias_nom}`}>
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            {!situation ? <div className="spinner" /> : (
              <>
                <div className="flex gap-3" style={{ flexWrap: 'wrap', marginBottom: 'var(--espace-4)' }}>
                  <Badge couleur={(STATUT_SCOLARITE[situation.statut_scolarite] || {}).couleur || 'gris'}>{(STATUT_SCOLARITE[situation.statut_scolarite] || {}).label}</Badge>
                  <Badge couleur="bleu">{situation.fiche?.modalite_paiement}</Badge>
                  <Badge couleur="gris">{Number(situation.total_paye).toLocaleString('fr-FR')} payés / {Number(situation.total_du).toLocaleString('fr-FR')} FCFA</Badge>
                </div>
                <div className="table-conteneur" style={{ maxHeight: 300 }}>
                  <table className="tableau" style={{ minWidth: 460 }}>
                    <thead><tr><th>#</th><th>Échéance</th><th>Dû</th><th>Payé</th><th>Statut</th></tr></thead>
                    <tbody>
                      {situation.echeances.map((e) => (
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
                <p className="mt-4" style={{ fontSize: 18 }}><strong>Reste à payer : <span style={{ color: Number(situation.reste) > 0 ? 'var(--rouge-700)' : 'var(--vert-700)' }}>{Number(situation.reste).toLocaleString('fr-FR')} FCFA</span></strong></p>
                {dernierPaiement && (
                  <div className="auth-succes mt-4" role="status">
                    Paiement {dernierPaiement.numero_recu} enregistré. Remettez le reçu rempli à la main ; joignez-en le scan ci-dessous (preuve « en cas de quoi »).
                    <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
                      <UploadPreuveRecu
                        base={base}
                        paymentId={dernierPaiement.id}
                        preuve={dernierPaiement.justificatif_chemin ?? null}
                        onChange={(chemin) => setDernierPaiement((p) => (p ? { ...p, justificatif_chemin: chemin } : p))}
                      />
                      <Button size="sm" variant="ghost" onClick={ouvrirAnnulation}>Annuler ce paiement</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* ===== Formulaire de paiement ===== */}
          <Card titre="Encaisser un paiement">
            <form onSubmit={payer}>
              <Input label="Montant (FCFA)" name="montant" inputMode="decimal" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="ex. 50000" requis autoFocus />
              <div className="mt-4">
                <Select label="Moyen de paiement" name="moyen" value={form.moyen} onChange={(e) => setForm({ ...form, moyen: e.target.value })}>
                  {Object.entries(MOYEN_LIB).map(([code, libelle]) => <option key={code} value={code}>{libelle}</option>)}
                </Select>
              </div>
              <div className="mt-4"><Input label="Référence de transaction (facultatif)" name="reference" value={form.reference_transaction} onChange={(e) => setForm({ ...form, reference_transaction: e.target.value })} placeholder="ex. n° Flooz / Mixx" /></div>
              <div className="mt-4"><Input label="Date de paiement (facultatif)" name="date" type="datetime-local" value={form.date_paiement} onChange={(e) => setForm({ ...form, date_paiement: e.target.value })} aide="Défaut : maintenant" /></div>
              <Button type="submit" className="mt-6 w-100" disabled={envoi || Number(situation?.reste || 0) <= 0}>
                {envoi ? 'Enregistrement…' : Number(situation?.reste || 0) <= 0 ? 'Compte soldé' : 'Enregistrer le paiement'}
              </Button>
              <p className="text-doux mt-4" style={{ fontSize: 12 }}>La ventilation sur les échéances est automatique (les plus anciennes d’abord). Le reçu porte un numéro séquentiel unique ; il se remplit à la main — joignez le scan en preuve.</p>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
