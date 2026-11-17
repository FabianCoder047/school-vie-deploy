// Années académiques — création, édition, définition de l'année courante.
import { useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import SearchBar from '../../components/SearchBar';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';

function formaterDateFr(iso) {
  if (!iso) return '—';
  const [a, m, j] = String(iso).slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

function ecartEnMois(d1, d2) {
  if (!d1 || !d2) return null;
  const a = new Date(d1);
  const b = new Date(d2);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export default function AnneesPage() {
  const toast = useToast();
  const { supprimer, confirmer } = useConfirm();
  const liste = usePaginatedResource('/annees-academiques');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState({ libelle: '', date_debut: '', date_fin: '' });

  const ouvrirCreation = () => {
    setEnEdition(null);
    const an = new Date().getFullYear();
    setForm({ libelle: `${an}-${an + 1}`, date_debut: `${an}-09-01`, date_fin: `${an + 1}-06-30` });
    setErreur('');
    setModalOuvert(true);
  };
  const ouvrirEdition = (annee) => {
    setEnEdition(annee);
    setForm({ libelle: annee.libelle, date_debut: String(annee.date_debut).slice(0, 10), date_fin: String(annee.date_fin).slice(0, 10) });
    setErreur('');
    setModalOuvert(true);
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const payload = { libelle: form.libelle.trim(), date_debut: form.date_debut, date_fin: form.date_fin };
      if (enEdition) await api.put(`/admin/annees-academiques/${enEdition.id}`, payload);
      else await api.post('/admin/annees-academiques', payload);
      toast.succes(enEdition ? 'Année mise à jour.' : 'Année créée.');
      setModalOuvert(false);
      liste.recharger();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const definirCourante = async (annee) => {
    if (annee.is_current) return;
    const ok = await confirmer({
      titre: 'Définir l’année courante',
      message: `« ${annee.libelle} » deviendra l’année courante. Toutes les données métier (inscriptions, paiements, notes…) y seront rattachées. Continuer ?`,
      texteConfirmer: 'Définir comme courante',
      type: 'avertissement',
    });
    if (!ok) return;
    try {
      await api.post(`/admin/annees-academiques/${annee.id}/courante`);
      toast.succes(`Année ${annee.libelle} définie comme courante.`);
      liste.recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Action impossible.'));
    }
  };

  const retirer = async (annee) => {
    const ok = await supprimer(`Supprimer l’année « ${annee.libelle} » ?`, 'Supprimer l’année');
    if (!ok) return;
    try {
      await api.delete(`/admin/annees-academiques/${annee.id}`);
      toast.succes('Année supprimée.');
      liste.recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Suppression impossible.'));
    }
  };

  const colonnes = [
    { cle: 'libelle', titre: 'Année', rendu: (a) => <strong>{a.libelle}</strong> },
    { cle: 'date_debut', titre: 'Début', rendu: (a) => formaterDateFr(a.date_debut) },
    { cle: 'date_fin', titre: 'Fin', rendu: (a) => formaterDateFr(a.date_fin) },
    { cle: 'is_current', titre: 'Statut', rendu: (a) => a.is_current ? <Badge couleur="vert">Courante</Badge> : <Badge couleur="gris">—</Badge> },
    {
      cle: 'actions', titre: 'Actions', largeur: 300,
      rendu: (a) => (
        <div className="flex gap-2">
          {!a.is_current && <Button size="sm" variant="outline" onClick={() => definirCourante(a)}>Définir courante</Button>}
          <Button size="sm" variant="ghost" onClick={() => ouvrirEdition(a)}>Modifier</Button>
          {!a.is_current && <Button size="sm" variant="danger" onClick={() => retirer(a)}>Supprimer</Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <h1 className="page-titre">Années académiques</h1>
      <p className="text-doux mb-4">Une seule année courante à la fois. Toutes les données métier y sont rattachées.</p>
      <div className="flex-between mb-4 gap-3" style={{ flexWrap: 'wrap' }}>
        <SearchBar valeur={liste.search} onChange={liste.setSearch} placeholder="Rechercher une année…" />
        <Button onClick={ouvrirCreation}>+ Nouvelle année</Button>
      </div>
      <DataTable columns={colonnes} data={liste.items} enChargement={liste.enChargement} messageVide="Aucune année académique." />
      <Pagination page={liste.page} totalPages={liste.totalPages} total={liste.total} parPage={liste.parPage} onChangePage={liste.setPage} onChangeParPage={liste.setParPage} />

      {modalOuvert && (
        <Modal titre={enEdition ? 'Modifier l’année' : 'Nouvelle année académique'} onFermer={() => setModalOuvert(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setModalOuvert(false)}>Annuler</Button>
              <Button type="submit" form="form-annee" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          )}>
          <form id="form-annee" onSubmit={enregistrer}>
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            <Input label="Libellé" name="libelle" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} placeholder="ex. 2027-2028" requis autoFocus />
            <div className="grid-2 mt-4">
              <Input label="Date de début" name="date_debut" type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} requis />
              <Input label="Date de fin" name="date_fin" type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} requis />
            </div>
            {form.date_debut && form.date_fin && ecartEnMois(form.date_debut, form.date_fin) !== 9 && (
              <p className="champ-aide" style={{ color: 'var(--couleur-avertissement)', marginTop: 6 }}>
                L’année académique fait normalement 9 mois (début : septembre ou octobre ; fin : mai ou juin).
              </p>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
