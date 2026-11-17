// Classes par cycle — CRUD réservé à l'Admin, sélecteur de cycle.
import { useEffect, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import SearchBar from '../../components/SearchBar';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import FilterBar from '../../components/FilterBar';
import SelectFiltre from '../../components/SelectFiltre';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import Select from '../../components/Select';

export default function ClassesPage() {
  const toast = useToast();
  const { supprimer } = useConfirm();
  const [cycleFiltre, setCycleFiltre] = useState('');
  const liste = usePaginatedResource('/classes', cycleFiltre ? { cycle_id: cycleFiltre } : {});
  const [cycles, setCycles] = useState([]);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState({ cycle_id: '', nom: '', ordre: 0 });

  useEffect(() => {
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
  }, []);

  const ouvrirCreation = () => { setEnEdition(null); setForm({ cycle_id: cycleFiltre || '', nom: '', ordre: 0 }); setErreur(''); setModalOuvert(true); };
  const ouvrirEdition = (classe) => { setEnEdition(classe); setForm({ cycle_id: classe.cycle_id, nom: classe.nom, ordre: classe.ordre }); setErreur(''); setModalOuvert(true); };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!form.cycle_id) { setErreur('Choisissez un cycle.'); return; }
    setEnvoi(true);
    try {
      const payload = { cycle_id: Number(form.cycle_id), nom: form.nom.trim(), ordre: Number(form.ordre) || 0 };
      if (enEdition) await api.put(`/admin/classes/${enEdition.id}`, payload);
      else await api.post('/admin/classes', payload);
      toast.succes(enEdition ? 'Classe mise à jour.' : 'Classe créée.');
      setModalOuvert(false);
      liste.recharger();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (classe) => {
    const ok = await supprimer(`Supprimer la classe « ${classe.nom} » ?`, 'Supprimer la classe');
    if (!ok) return;
    try {
      await api.delete(`/admin/classes/${classe.id}`);
      toast.succes('Classe supprimée.');
      liste.recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Suppression impossible.'));
    }
  };

  const colonnes = [
    { cle: 'cycle_nom', titre: 'Cycle', rendu: (c) => <Badge couleur="bleu">{c.cycle_nom}</Badge> },
    { cle: 'ordre', titre: 'Ordre', largeur: 80 },
    { cle: 'nom', titre: 'Classe', rendu: (c) => <strong>{c.nom}</strong> },
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
      <h1 className="page-titre">Classes</h1>
      <p className="text-doux mb-4">Classes par cycle (ex : CP1, CP2, CE1 dans le cycle « Primaire »).</p>
      <div className="flex-between mb-4 gap-3" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterBar>
          <SearchBar valeur={liste.search} onChange={liste.setSearch} placeholder="Rechercher une classe…" />
          <SelectFiltre label="Cycle" value={cycleFiltre} onChange={(e) => setCycleFiltre(e.target.value)}>
            <option value="">Tous les cycles</option>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </SelectFiltre>
        </FilterBar>
        <Button onClick={ouvrirCreation}>+ Nouvelle classe</Button>
      </div>
      <DataTable columns={colonnes} data={liste.items} enChargement={liste.enChargement} messageVide="Aucune classe. Créez-en une." />
      <Pagination page={liste.page} totalPages={liste.totalPages} total={liste.total} parPage={liste.parPage} onChangePage={liste.setPage} onChangeParPage={liste.setParPage} />

      {modalOuvert && (
        <Modal titre={enEdition ? 'Modifier la classe' : 'Nouvelle classe'} onFermer={() => setModalOuvert(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setModalOuvert(false)}>Annuler</Button>
              <Button type="submit" form="form-classe" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          )}>
          <form id="form-classe" onSubmit={enregistrer}>
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            <Select label="Cycle" name="cycle_id" value={form.cycle_id} onChange={(e) => setForm({ ...form, cycle_id: e.target.value })} requis>
              <option value="">— Choisir un cycle —</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Select>
            <div className="mt-4"><Input label="Nom" name="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex. CP1" requis autoFocus /></div>
            <div className="mt-4"><Input label="Ordre d’affichage" name="ordre" type="number" min="0" value={form.ordre} onChange={(e) => setForm({ ...form, ordre: e.target.value })} aide="0 = en premier" /></div>
          </form>
        </Modal>
      )}
    </>
  );
}
