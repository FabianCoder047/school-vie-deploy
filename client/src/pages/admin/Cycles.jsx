// Cycles scolaires (Primaire, Collège…) — CRUD réservé à l'Admin.
import { useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import SearchBar from '../../components/SearchBar';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Textarea from '../../components/Textarea';

export default function CyclesPage() {
  const toast = useToast();
  const { supprimer } = useConfirm();
  const liste = usePaginatedResource('/cycles');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState({ nom: '', description: '', ordre: 0 });

  const ouvrirCreation = () => { setEnEdition(null); setForm({ nom: '', description: '', ordre: 0 }); setErreur(''); setModalOuvert(true); };
  const ouvrirEdition = (cycle) => { setEnEdition(cycle); setForm({ nom: cycle.nom, description: cycle.description || '', ordre: cycle.ordre }); setErreur(''); setModalOuvert(true); };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const payload = { nom: form.nom.trim(), description: form.description.trim() || null, ordre: Number(form.ordre) || 0 };
      if (enEdition) await api.put(`/admin/cycles/${enEdition.id}`, payload);
      else await api.post('/admin/cycles', payload);
      toast.succes(enEdition ? 'Cycle mis à jour.' : 'Cycle créé.');
      setModalOuvert(false);
      liste.recharger();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (cycle) => {
    const ok = await supprimer(`Supprimer le cycle « ${cycle.nom} » ?`, 'Supprimer le cycle');
    if (!ok) return;
    try {
      await api.delete(`/admin/cycles/${cycle.id}`);
      toast.succes('Cycle supprimé.');
      liste.recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Suppression impossible.'));
    }
  };

  const colonnes = [
    { cle: 'ordre', titre: 'Ordre', largeur: 80 },
    { cle: 'nom', titre: 'Cycle', rendu: (c) => <strong>{c.nom}</strong> },
    { cle: 'description', titre: 'Description', rendu: (c) => c.description || '—' },
    {
      cle: 'actions', titre: 'Actions', largeur: 180,
      rendu: (c) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => ouvrirEdition(c)}>Modifier</Button>
          <Button size="sm" variant="danger" onClick={() => retirer(c)}>Supprimer</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <h1 className="page-titre">Cycles scolaires</h1>
      <p className="text-doux mb-4">Socle de la hiérarchie des classes (ex : Primaire → CP1, CP2…).</p>
      <div className="flex-between mb-4 gap-3" style={{ flexWrap: 'wrap' }}>
        <SearchBar valeur={liste.search} onChange={liste.setSearch} placeholder="Rechercher un cycle…" />
        <Button onClick={ouvrirCreation}>+ Nouveau cycle</Button>
      </div>
      <DataTable columns={colonnes} data={liste.items} enChargement={liste.enChargement} messageVide="Aucun cycle. Créez-en un." />
      <Pagination page={liste.page} totalPages={liste.totalPages} total={liste.total} parPage={liste.parPage} onChangePage={liste.setPage} onChangeParPage={liste.setParPage} />

      {modalOuvert && (
        <Modal titre={enEdition ? 'Modifier le cycle' : 'Nouveau cycle'} onFermer={() => setModalOuvert(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setModalOuvert(false)}>Annuler</Button>
              <Button type="submit" form="form-cycle" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          )}>
          <form id="form-cycle" onSubmit={enregistrer}>
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            <Input label="Nom" name="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex. Primaire" requis autoFocus />
            <div className="mt-4"><Textarea label="Description" name="description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ex. Enseignement primaire" /></div>
            <div className="mt-4"><Input label="Ordre d’affichage" name="ordre" type="number" min="0" value={form.ordre} onChange={(e) => setForm({ ...form, ordre: e.target.value })} aide="0 = en premier" /></div>
          </form>
        </Modal>
      )}
    </>
  );
}
