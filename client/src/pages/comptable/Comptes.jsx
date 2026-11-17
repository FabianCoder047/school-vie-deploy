// Comptes de scolarité : consultation filtrable, détail par élève,
// fiche de retard (PDF) et relance individuelle.
import { useEffect, useMemo, useState } from 'react';
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

const STATUT_SCOLARITE = {
  SOLDE: { couleur: 'vert', label: 'Soldé' },
  A_JOUR: { couleur: 'bleu', label: 'À jour' },
  EN_RETARD: { couleur: 'rouge', label: 'En retard' },
};

export default function ComptesPage() {
  const toast = useToast();
  const [cycleFiltre, setCycleFiltre] = useState('');
  const [classeFiltre, setClasseFiltre] = useState('');
  const [statutFiltre, setStatutFiltre] = useState('');
  const [modaliteFiltre, setModaliteFiltre] = useState('');
  const liste = usePaginatedResource('/comptable/comptes', {
    ...(cycleFiltre ? { cycle_id: cycleFiltre } : {}),
    ...(classeFiltre ? { class_id: classeFiltre } : {}),
    ...(statutFiltre ? { statut: statutFiltre } : {}),
    ...(modaliteFiltre ? { modalite_paiement: modaliteFiltre } : {}),
  });

  const [cycles, setCycles] = useState([]);
  const [classesFiltrees, setClassesFiltrees] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [apercuPdf, setApercuPdf] = useState(null); // { url, titre }
  const [waLink, setWaLink] = useState(null);
  const [relanceEnCours, setRelanceEnCours] = useState(false);

  useEffect(() => {
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
  }, []);
  useEffect(() => {
    const url = cycleFiltre ? `/classes?cycle_id=${cycleFiltre}&parPage=100` : '/classes/toutes';
    api.get(url).then(({ data }) => setClassesFiltrees(data.rows || [])).catch(() => setClassesFiltrees([]));
  }, [cycleFiltre]);

  const relancerUn = async (compte) => {
    setRelanceEnCours(true);
    try {
      const { data } = await api.post('/comptable/relances', { enrollment_ids: [compte.enrollment_id] });
      const premier = data.resultats?.[0];
      if (premier?.waLink) setWaLink({ eleve: premier.eleve, link: premier.waLink, notification: premier.notificationCreee });
      else toast.succes('Relance enregistrée.');
      liste.recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Relance impossible.'));
    } finally {
      setRelanceEnCours(false);
    }
  };

  const exporterFichesRetard = () => {
    const params = new URLSearchParams();
    if (cycleFiltre) params.set('cycle_id', cycleFiltre);
    if (classeFiltre) params.set('class_id', classeFiltre);
    if (modaliteFiltre) params.set('modalite_paiement', modaliteFiltre);
    setApercuPdf({ url: `/comptable/fiches-retard/pdf?${params.toString()}`, titre: 'Fiches de retard' });
  };

  const colonnes = [
    { cle: 'matricule', titre: 'Matricule', rendu: (r) => <code style={{ fontSize: 12 }}>{r.matricule}</code> },
    { cle: 'nom', titre: 'Élève', rendu: (r) => <strong>{r.prenom} {r.nom}</strong> },
    { cle: 'classe', titre: 'Classe / Alias', rendu: (r) => `${r.classe_nom} · ${r.alias_nom}` },
    { cle: 'modalite_paiement', titre: 'Modalité', rendu: (r) => r.modalite_paiement.charAt(0) + r.modalite_paiement.slice(1).toLowerCase() },
    { cle: 'total_du', titre: 'Dû', rendu: (r) => Number(r.total_du).toLocaleString('fr-FR') },
    { cle: 'total_paye', titre: 'Payé', rendu: (r) => Number(r.total_paye).toLocaleString('fr-FR') },
    { cle: 'reste', titre: 'Reste', rendu: (r) => <strong style={{ color: Number(r.reste) > 0 ? 'var(--rouge-700)' : 'var(--vert-700)' }}>{Number(r.reste).toLocaleString('fr-FR')}</strong> },
    { cle: 'statut_scolarite', titre: 'Statut', rendu: (r) => {
        const s = STATUT_SCOLARITE[r.statut_scolarite] || { couleur: 'gris', label: r.statut_scolarite };
        return <Badge couleur={s.couleur}>{s.label}</Badge>;
      } },
    {
      cle: 'actions', titre: 'Actions', largeur: 230,
      rendu: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetailId(r.enrollment_id)}>Détail</Button>
          <Button size="sm" variant="warning" disabled={relanceEnCours || Number(r.reste) <= 0} onClick={() => relancerUn(r)}>Relancer</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <h1 className="page-titre">Comptes de scolarité</h1>
      <div className="flex-between mb-4 gap-3" style={{ flexWrap: 'wrap' }}>
        <FilterBar>
          <SearchBar valeur={liste.search} onChange={liste.setSearch} placeholder="Nom, prénom ou matricule…" />
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
            <option value="EN_RETARD">En retard</option>
            <option value="A_JOUR">À jour</option>
            <option value="SOLDE">Soldé</option>
          </SelectFiltre>
          <SelectFiltre label="Modalité" value={modaliteFiltre} onChange={(e) => setModaliteFiltre(e.target.value)}>
            <option value="">Toutes les modalités</option>
            <option value="JOURNALIER">Journalier</option>
            <option value="HEBDOMADAIRE">Hebdomadaire</option>
            <option value="MENSUEL">Mensuel</option>
            <option value="TRIMESTRIEL">Trimestriel</option>
            <option value="SEMESTRIEL">Semestriel</option>
          </SelectFiltre>
        </FilterBar>
        <Button variant="secondary" onClick={exporterFichesRetard} title="Un PDF groupé (une fiche par élève en retard, selon la modalité)">
          Fiches de retard (PDF)
        </Button>
      </div>

      <DataTable columns={colonnes} data={liste.items} cleLigne="enrollment_id" enChargement={liste.enChargement} messageVide="Aucun compte." />
      <Pagination page={liste.page} totalPages={liste.totalPages} total={liste.total} parPage={liste.parPage} onChangePage={liste.setPage} onChangeParPage={liste.setParPage} />

      {detailId && <DetailCompteModal detailId={detailId} onFermer={() => setDetailId(null)} />}
      {apercuPdf && <ApercuPdf titre={apercuPdf.titre} url={apercuPdf.url} onFermer={() => setApercuPdf(null)} />}

      {waLink && (
        <Modal titre="Relance envoyée" onFermer={() => setWaLink(null)}
          footer={<Button variant="primary" onClick={() => setWaLink(null)}>Fermer</Button>}>
          <div className="auth-succes" role="status">
            Relance enregistrée pour <strong>{waLink.eleve}</strong> : notification interne créée.
          </div>
          <p className="mt-4 text-doux" style={{ fontSize: 13 }}>Ouvrez WhatsApp pour envoyer le message pré-rempli au tuteur (aucun e-mail disponible ou choix du canal) :</p>
          <a className="btn btn-success mt-4" href={waLink.link} target="_blank" rel="noopener noreferrer">Ouvrir WhatsApp</a>
        </Modal>
      )}
    </>
  );
}

/* ===== Détail d'un compte : échéances + paiements ===== */
function DetailCompteModal({ detailId, onFermer }) {
  const [situation, setSituation] = useState(null);
  const [erreur, setErreur] = useState('');
  const [apercuPdf, setApercuPdf] = useState(null); // { url, titre }

  useEffect(() => {
    api.get(`/comptable/comptes/${detailId}/situation`).then(({ data }) => setSituation(data)).catch((err) => setErreur(messageErreur(err, 'Chargement impossible.')));
  }, [detailId]);

  const MOYEN_LIB = { ESPECES: 'Espèces', FLOOZ: 'Flooz', MIXX_BY_YAS: 'Mixx By Yas' };

  return (
    <Modal titre="Fiche de situation" onFermer={onFermer} taille="lg"
      footer={<Button variant="secondary" onClick={onFermer}>Fermer</Button>}>
      {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
      {!situation ? <div className="spinner" style={{ margin: '24px auto' }} /> : (
        <>
          <h4 style={{ fontWeight: 800 }}>{situation.fiche.prenom} {situation.fiche.nom} <span className="text-doux" style={{ fontWeight: 400 }}>— {situation.fiche.matricule}</span></h4>
          <p className="text-doux">{situation.fiche.classe_nom} · {situation.fiche.alias_nom} — Modalité {situation.fiche.modalite_paiement} — Tuteur : {situation.fiche.tuteur_prenom} {situation.fiche.tuteur_nom} ({situation.fiche.tuteur_whatsapp})</p>
          <p className="mt-4"><strong>Reste : {Number(situation.reste).toLocaleString('fr-FR')} FCFA</strong> sur {Number(situation.total_du).toLocaleString('fr-FR')} FCFA — payé : {Number(situation.total_paye).toLocaleString('fr-FR')} FCFA</p>

          <p className="sidebar-section mt-4" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px', marginBottom: 8 }}>Échéances</p>
          <div className="table-conteneur" style={{ maxHeight: 240 }}>
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

          <p className="sidebar-section mt-4" style={{ color: 'var(--bleu-800)', background: 'var(--bleu-50)', borderRadius: 'var(--rayon-sm)', padding: '6px 10px', marginBottom: 8 }}>Paiements</p>
          {situation.payments.length === 0 ? <p className="text-doux">Aucun paiement enregistré.</p> : (
            <div className="table-conteneur" style={{ maxHeight: 200 }}>
              <table className="tableau" style={{ minWidth: 460 }}>
                <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Moyen</th><th>Reçu</th><th>Statut</th></tr></thead>
                <tbody>
                  {situation.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                      <td>{p.type === 'INSCRIPTION' ? 'Inscription' : 'Scolarité'}</td>
                      <td>{Number(p.montant).toLocaleString('fr-FR')}</td>
                      <td>{MOYEN_LIB[p.moyen] || p.moyen}</td>
                      <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setApercuPdf({ url: `/comptable/paiements/${p.id}/recu`, titre: `Reçu ${p.numero_recu}` })}>{p.numero_recu}</button></td>
                      <td><Badge couleur={p.statut === 'VALIDE' ? 'vert' : 'rouge'}>{p.statut === 'VALIDE' ? 'Validé' : 'Annulé'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {apercuPdf && <ApercuPdf titre={apercuPdf.titre} url={apercuPdf.url} onFermer={() => setApercuPdf(null)} />}
    </Modal>
  );
}
