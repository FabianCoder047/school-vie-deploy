// Liste des élèves + fiche complète (consultation / modification / situation).
import { useEffect, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { useToast } from '../../hooks/useToast';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import SearchBar from '../../components/SearchBar';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import FilterBar from '../../components/FilterBar';
import SelectFiltre from '../../components/SelectFiltre';
import Modal from '../../components/Modal';
import ApercuPdf from '../../components/ApercuPdf';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Textarea from '../../components/Textarea';
import { useConfirm } from '../../hooks/useConfirm';

const STATUT_INSCRIPTION = {
  EN_ATTENTE: { couleur: 'jaune', label: 'En attente' },
  INSCRIT: { couleur: 'vert', label: 'Inscrit' },
  ANNULE: { couleur: 'rouge', label: 'Annulé' },
};

export default function ElevesPage() {
  const toast = useToast();
  const [cycleFiltre, setCycleFiltre] = useState('');
  const [classeFiltre, setClasseFiltre] = useState('');
  const [statutFiltre, setStatutFiltre] = useState('');
  const liste = usePaginatedResource('/secretaire/eleves', {
    ...(cycleFiltre ? { cycle_id: cycleFiltre } : {}),
    ...(classeFiltre ? { class_id: classeFiltre } : {}),
    ...(statutFiltre ? { statut: statutFiltre } : {}),
  });

  const [cycles, setCycles] = useState([]);
  const [classesFiltrees, setClassesFiltrees] = useState([]);
  const [ficheId, setFicheId] = useState(null);

  useEffect(() => {
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
  }, []);
  useEffect(() => {
    const url = cycleFiltre ? `/classes?cycle_id=${cycleFiltre}&parPage=100` : '/classes/toutes';
    api.get(url).then(({ data }) => setClassesFiltrees(data.rows || [])).catch(() => setClassesFiltrees([]));
  }, [cycleFiltre]);

  const colonnes = [
    { cle: 'photo', titre: '', largeur: 56, rendu: (r) => {
        const url = photoUrl(r.photo_path);
        return url
          ? <img src={url} alt="" style={{ width: 40, height: 40, borderRadius: 'var(--rayon-plein)', objectFit: 'cover' }} />
          : <div style={{ width: 40, height: 40, borderRadius: 'var(--rayon-plein)', background: 'var(--bleu-100)', color: 'var(--bleu-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{(r.prenom?.[0] || '?').toUpperCase()}{(r.nom?.[0] || '').toUpperCase()}</div>;
      } },
    { cle: 'matricule', titre: 'Matricule', rendu: (r) => <code style={{ fontSize: 12 }}>{r.matricule}</code> },
    { cle: 'nom', titre: 'Élève', rendu: (r) => <strong>{r.nom} {r.prenom}</strong> },
    { cle: 'classe', titre: 'Classe / Alias', rendu: (r) => `${r.classe_nom} · ${r.alias_nom}` },
    { cle: 'cycle_nom', titre: 'Cycle', rendu: (r) => <Badge couleur="bleu">{r.cycle_nom}</Badge> },
    { cle: 'statut', titre: 'Statut', rendu: (r) => {
        const s = STATUT_INSCRIPTION[r.statut] || { couleur: 'gris', label: r.statut };
        return <Badge couleur={s.couleur}>{s.label}</Badge>;
      } },
    {
      cle: 'actions', titre: '', largeur: 110,
      rendu: (r) => <Button size="sm" variant="outline" onClick={() => setFicheId(r.enrollment_id)}>Voir</Button>,
    },
  ];

  return (
    <>
      <h1 className="page-titre">Élèves</h1>
      <FilterBar className="mb-4">
        <SearchBar valeur={liste.search} onChange={liste.setSearch} placeholder="Rechercher un nom, prénom ou matricule…" />
        <SelectFiltre label="Cycle" value={cycleFiltre} onChange={(e) => { setCycleFiltre(e.target.value); setClasseFiltre(''); }}>
          <option value="">Tous les cycles</option>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </SelectFiltre>
        <SelectFiltre label="Classe" value={classeFiltre} onChange={(e) => setClasseFiltre(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classesFiltrees.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </SelectFiltre>
        <SelectFiltre label="Statut" value={statutFiltre} onChange={(e) => setStatutFiltre(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="EN_ATTENTE">En attente</option>
          <option value="INSCRIT">Inscrit</option>
        </SelectFiltre>
      </FilterBar>
      <DataTable columns={colonnes} data={liste.items} cleLigne="enrollment_id" enChargement={liste.enChargement} messageVide="Aucun élève trouvé." />
      <Pagination page={liste.page} totalPages={liste.totalPages} total={liste.total} parPage={liste.parPage} onChangePage={liste.setPage} onChangeParPage={liste.setParPage} />

      {ficheId && <FicheEleveModal ficheId={ficheId} onFermer={() => setFicheId(null)} onModifie={liste.recharger} />}
    </>
  );
}

function photoUrl(photoPath) {
  if (!photoPath) return null;
  const origine = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return photoPath.startsWith('http') ? photoPath : `${origine}${photoPath}`;
}

/* ============ Fiche complète (consultation / édition / paiement / photo) ============ */
function FicheEleveModal({ ficheId, onFermer, onModifie }) {
  const toast = useToast();
  const { supprimer } = useConfirm();
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enEdition, setEnEdition] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState(null);

  const [modalInscription, setModalInscription] = useState(false);
  const [paiement, setPaiement] = useState({ moyen: 'ESPECES', reference_transaction: '' });
  const [paiementEnCours, setPaiementEnCours] = useState(false);
  const [paiementErreur, setPaiementErreur] = useState('');
  const [paymentInscriptionId, setPaymentInscriptionId] = useState(null);
  const [apercuPdf, setApercuPdf] = useState(null); // { url, titre }

  const charger = () => api.get(`/secretaire/eleves/${ficheId}`).then(({ data }) => {
    setFiche(data);
    setPaymentInscriptionId(data.paiementInscription?.id || null);
  }).catch((err) => setErreur(messageErreur(err, 'Chargement impossible.')));

  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [ficheId]);

  const ouvrirEdition = () => {
    setForm({
      nom: fiche.nom, prenom: fiche.prenom, sexe: fiche.sexe || '',
      date_naissance: String(fiche.date_naissance).slice(0, 10),
      lieu_naissance: fiche.lieu_naissance, adresse: fiche.adresse,
      tuteur: { nom: fiche.tuteur_nom, prenom: fiche.tuteur_prenom, telephone_whatsapp: fiche.tuteur_whatsapp, email: fiche.tuteur_email || '' },
    });
    setEnEdition(true);
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      await api.put(`/secretaire/eleves/${ficheId}`, {
        nom: form.nom, prenom: form.prenom, sexe: form.sexe || null,
        date_naissance: form.date_naissance, lieu_naissance: form.lieu_naissance, adresse: form.adresse,
        tuteur: { ...form.tuteur, email: form.tuteur.email || null },
      });
      toast.succes('Fiche mise à jour.');
      setEnEdition(false);
      charger();
      onModifie?.();
    } catch (err) {
      setErreur(messageErreur(err, 'Mise à jour impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const supprimerPhoto = async () => {
    const ok = await supprimer('Retirer la photo de cet élève ?', 'Supprimer la photo');
    if (!ok) return;
    try {
      await api.delete(`/secretaire/eleves/${ficheId}/photo`);
      toast.succes('Photo retirée.');
      charger();
      onModifie?.();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Suppression de la photo impossible.'));
    }
  };

  const choisirPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const donnees = new FormData();
    donnees.append('photo', fichier);
    try {
      await api.post(`/secretaire/eleves/${ficheId}/photo`, donnees, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.succes('Photo mise à jour.');
      charger();
      onModifie?.();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Envoi de la photo impossible.'));
    } finally {
      e.target.value = '';
    }
  };

  const payerInscription = async (e) => {
    e.preventDefault();
    setPaiementErreur('');
    setPaiementEnCours(true);
    try {
      const { data } = await api.post(`/secretaire/eleves/${ficheId}/paiement-inscription`, {
        moyen: paiement.moyen,
        reference_transaction: paiement.reference_transaction.trim() || null,
      });
      setPaymentInscriptionId(data.paiement?.id);
      setModalInscription(false);
      toast.succes('Paiement d’inscription enregistré.');
      charger();
      onModifie?.();
    } catch (err) {
      setPaiementErreur(messageErreur(err, 'Paiement impossible.'));
    } finally {
      setPaiementEnCours(false);
    }
  };

  if (erreur && !fiche) {
    return <Modal titre="Fiche élève" onFermer={onFermer}><div className="auth-erreur" role="alert">{erreur}</div></Modal>;
  }
  if (!fiche) {
    return <Modal titre="Fiche élève" onFermer={onFermer}><div className="spinner" style={{ margin: '24px auto' }} /></Modal>;
  }

  const statut = STATUT_INSCRIPTION[fiche.statut] || { couleur: 'gris', label: fiche.statut };

  return (
    <Modal titre="Fiche élève" onFermer={onFermer} taille="xl"
      footer={!enEdition && (
        <>
          <Button variant="secondary" onClick={onFermer}>Fermer</Button>
          <Button onClick={ouvrirEdition}>Modifier la fiche</Button>
        </>
      )}>
      {/* En-tête identité */}
      <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          {fiche.photo_path
            ? <img src={photoUrl(fiche.photo_path)} alt={`${fiche.prenom} ${fiche.nom}`} style={{ width: 88, height: 88, borderRadius: 'var(--rayon-md)', objectFit: 'cover' }} />
            : <div style={{ width: 88, height: 88, borderRadius: 'var(--rayon-md)', background: 'var(--bleu-100)', color: 'var(--bleu-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22 }}>{fiche.prenom?.[0]}{fiche.nom?.[0]}</div>}
          <label style={{ position: 'absolute', bottom: -6, right: -6, background: 'var(--bleu-700)', color: '#fff', borderRadius: 'var(--rayon-plein)', padding: 6, cursor: 'pointer' }} title="Changer la photo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={choisirPhoto} />
          </label>
          {fiche.photo_path && (
            <button
              type="button"
              onClick={supprimerPhoto}
              title="Retirer la photo"
              aria-label="Retirer la photo"
              style={{ position: 'absolute', bottom: -6, left: -6, background: 'var(--rouge-600)', color: '#fff', border: 'none', borderRadius: 'var(--rayon-plein)', padding: 6, cursor: 'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          )}
        </div>
        <div>
          <h3 style={{ fontSize: 19, fontWeight: 800 }}>{fiche.prenom} {fiche.nom}</h3>
          <p className="text-doux"><code>{fiche.matricule}</code> — {fiche.classe_nom} · {fiche.alias_nom} — {fiche.annee_libelle}</p>
          <p className="mt-4"><Badge couleur={statut.couleur}>{statut.label}</Badge>{' '}<Badge couleur="bleu">{fiche.modalite_paiement}</Badge></p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div className="text-doux" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>Reste à payer</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: Number(fiche.reste) > 0 ? 'var(--rouge-700)' : 'var(--vert-700)' }}>{Number(fiche.reste).toLocaleString('fr-FR')} FCFA</div>
          <div style={{ fontSize: 12, color: 'var(--texte-doux)' }}>Payé : {Number(fiche.total_paye).toLocaleString('fr-FR')} / {Number(fiche.total_du).toLocaleString('fr-FR')} FCFA</div>
        </div>
      </div>

      {enEdition ? (
        /* ===== MODE ÉDITION ===== */
        <form onSubmit={enregistrer} className="mt-6">
          {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
          <div className="grid-2">
            <Input label="Nom" name="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} requis />
            <Input label="Prénom" name="prenom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} requis />
          </div>
          <div className="grid-2 mt-4">
            <Select label="Sexe" name="sexe" value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
              <option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option>
            </Select>
            <Input label="Date de naissance" name="dn" type="date" value={form.date_naissance} onChange={(e) => setForm({ ...form, date_naissance: e.target.value })} required />
          </div>
          <div className="mt-4"><Input label="Lieu de naissance" name="ln" value={form.lieu_naissance} onChange={(e) => setForm({ ...form, lieu_naissance: e.target.value })} required /></div>
          <div className="mt-4"><Input label="Adresse" name="adr" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} required /></div>
          <p className="sidebar-section" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px', margin: '16px 0 8px' }}>Tuteur</p>
          <div className="grid-2">
            <Input label="Nom" name="tn" value={form.tuteur.nom} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, nom: e.target.value } })} required />
            <Input label="Prénom" name="tp" value={form.tuteur.prenom} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, prenom: e.target.value } })} required />
          </div>
          <div className="grid-2 mt-4">
            <Input label="Téléphone WhatsApp" name="tt" value={form.tuteur.telephone_whatsapp} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, telephone_whatsapp: e.target.value } })} required />
            <Input label="E-mail" name="te" type="email" value={form.tuteur.email} onChange={(e) => setForm({ ...form, tuteur: { ...form.tuteur, email: e.target.value } })} />
          </div>
          <div className="flex gap-3 mt-6" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setEnEdition(false)}>Annuler</Button>
            <Button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        </form>
      ) : (
        <>
          {/* ===== MODE LECTURE ===== */}
          <div className="grid-2 mt-6">
            <div>
              <p className="sidebar-section" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px', marginBottom: 8 }}>Élève</p>
              <p className="text-doux">Né(e) le {new Date(fiche.date_naissance).toLocaleDateString('fr-FR')} à {fiche.lieu_naissance}</p>
              <p className="text-doux">{fiche.adresse}</p>
              <p className="text-doux">Inscrit(e) le {new Date(fiche.date_inscription).toLocaleDateString('fr-FR')}</p>
            </div>
            <div>
              <p className="sidebar-section" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px', marginBottom: 8 }}>Tuteur</p>
              <p className="text-doux">{fiche.tuteur_prenom} {fiche.tuteur_nom} — {fiche.tuteur_whatsapp}{fiche.tuteur_email ? ` — ${fiche.tuteur_email}` : ''}</p>
              <p className="text-doux">Compte parent : <Badge couleur="vert">{fiche.parent_user_id ? 'Créé' : 'Absent'}</Badge></p>
            </div>
          </div>

          {/* Frais d'inscription + paiement */}
          <div className="card mt-4" style={{ background: 'var(--jaune-50)', border: '1px solid var(--jaune-200)' }}>
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <strong>Frais d’inscription : {Number(fiche.frais_inscription).toLocaleString('fr-FR')} FCFA</strong>
                <p style={{ fontSize: 12, color: 'var(--jaune-800)' }}>{fiche.paiementInscription ? `Payés le ${new Date(fiche.paiementInscription.date_paiement).toLocaleDateString('fr-FR')} — reçu n° ${fiche.paiementInscription.numero_recu}` : 'Non réglés — l’élève est en attente.'}</p>
              </div>
              {fiche.paiementInscription ? (
                <Button variant="secondary" size="sm" onClick={() => setApercuPdf({ url: `/secretaire/paiements/${fiche.paiementInscription.id}/recu`, titre: `Reçu d’inscription — ${fiche.prenom} ${fiche.nom}` })}>Aperçu du reçu</Button>
              ) : (
                <Button size="sm" onClick={() => setModalInscription(true)}>Marquer payés</Button>
              )}
            </div>
          </div>

          {/* Échéances */}
          <p className="sidebar-section mt-6" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px', marginBottom: 8 }}>Échéancier ({fiche.echeances.length} échéance{fiche.echeances.length > 1 ? 's' : ''})</p>
          <div className="table-conteneur" style={{ maxHeight: 300 }}>
            <table className="tableau" style={{ minWidth: 520 }}>
              <thead><tr><th>#</th><th>Échéance</th><th>Dû</th><th>Payé</th><th>Statut</th></tr></thead>
              <tbody>
                {fiche.echeances.map((e) => (
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

          {/* Paiements */}
          {fiche.payments.length > 0 && (
            <>
              <p className="sidebar-section mt-6" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px', marginBottom: 8 }}>Paiements ({fiche.payments.length})</p>
              <div className="table-conteneur" style={{ maxHeight: 220 }}>
                <table className="tableau" style={{ minWidth: 520 }}>
                  <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Moyen</th><th>Reçu</th><th>Statut</th></tr></thead>
                  <tbody>
                    {fiche.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                        <td>{p.type === 'INSCRIPTION' ? 'Inscription' : 'Scolarité'}</td>
                        <td>{Number(p.montant).toLocaleString('fr-FR')}</td>
                        <td>{p.moyen === 'ESPECES' ? 'Espèces' : p.moyen === 'FLOOZ' ? 'Flooz' : 'Mixx By Yas'}</td>
                        <td>{p.numero_recu}</td>
                        <td><Badge couleur={p.statut === 'VALIDE' ? 'vert' : 'rouge'}>{p.statut === 'VALIDE' ? 'Validé' : 'Annulé'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Modal paiement inscription */}
      {modalInscription && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Paiement des frais d’inscription</h3><button type="button" className="modal-fermer" onClick={() => setModalInscription(false)} aria-label="Fermer">✕</button></div>
            <form onSubmit={payerInscription}>
              <div className="modal-body">
                {paiementErreur && <div className="auth-erreur" role="alert">{paiementErreur}</div>}
                <p className="mb-4"><strong>{Number(fiche.frais_inscription).toLocaleString('fr-FR')} FCFA</strong> à régler.</p>
                <Select label="Moyen de paiement" name="moyen" value={paiement.moyen} onChange={(e) => setPaiement({ ...paiement, moyen: e.target.value })}>
                  <option value="ESPECES">Espèces</option>
                  <option value="FLOOZ">Flooz</option>
                  <option value="MIXX_BY_YAS">Mixx By Yas</option>
                </Select>
                <div className="mt-4">
                  <Input label="Référence de transaction (facultatif)" name="reference" value={paiement.reference_transaction} onChange={(e) => setPaiement({ ...paiement, reference_transaction: e.target.value })} placeholder="ex. n° Flooz / Mixx" />
                </div>
              </div>
              <div className="modal-footer">
                <Button variant="secondary" type="button" onClick={() => setModalInscription(false)}>Annuler</Button>
                <Button type="submit" disabled={paiementEnCours}>{paiementEnCours ? 'Enregistrement…' : 'Enregistrer le paiement'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Aperçu du reçu dans l'application */}
      {apercuPdf && <ApercuPdf titre={apercuPdf.titre} url={apercuPdf.url} onFermer={() => setApercuPdf(null)} />}
    </Modal>
  );
}
