// Alias de classe (ex : CP1 A, CP1 B) — sélecteurs en cascade
// cycle → classe → alias.
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

export default function AliasPage() {
  const toast = useToast();
  const { supprimer } = useConfirm();
  const [cycleFiltre, setCycleFiltre] = useState('');
  const [classeFiltre, setClasseFiltre] = useState('');
  const liste = usePaginatedResource('/alias', { ...(cycleFiltre ? { cycle_id: cycleFiltre } : {}), ...(classeFiltre ? { class_id: classeFiltre } : {}) });

  const [cycles, setCycles] = useState([]);
  const [classesFiltrees, setClassesFiltrees] = useState([]);
  const [classesCascade, setClassesCascade] = useState([]); // pour le formulaire

  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [formCycle, setFormCycle] = useState('');
  const [form, setForm] = useState({ class_id: '', nom: '', capacite: '' });

  useEffect(() => {
    api.get('/cycles?parPage=100').then(({ data }) => setCycles(data.rows || [])).catch(() => setCycles([]));
  }, []);

  // Classes de la barre de filtre (selon le cycle choisi)
  useEffect(() => {
    const url = cycleFiltre ? `/classes?cycle_id=${cycleFiltre}&parPage=100` : '/classes/toutes';
    api.get(url).then(({ data }) => setClassesFiltrees(data.rows || [])).catch(() => setClassesFiltrees([]));
  }, [cycleFiltre]);

  // Classes de la cascade du formulaire (selon le cycle choisi dans le formulaire)
  useEffect(() => {
    if (!formCycle) { setClassesCascade([]); return; }
    api.get(`/classes?cycle_id=${formCycle}&parPage=100`).then(({ data }) => setClassesCascade(data.rows || [])).catch(() => setClassesCascade([]));
  }, [formCycle]);

  const ouvrirCreation = () => {
    setEnEdition(null);
    setFormCycle(cycleFiltre || '');
    setForm({ class_id: classeFiltre || '', nom: '', capacite: '' });
    setErreur('');
    setModalOuvert(true);
  };
  const ouvrirEdition = (alias) => {
    setEnEdition(alias);
    setFormCycle(String(alias.cycle_id));
    setForm({ class_id: String(alias.class_id), nom: alias.nom, capacite: alias.capacite ?? '' });
    setErreur('');
    setModalOuvert(true);
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!form.class_id) { setErreur('Choisissez une classe.'); return; }
    setEnvoi(true);
    try {
      const payload = { class_id: Number(form.class_id), nom: form.nom.trim(), capacite: form.capacite === '' ? null : Number(form.capacite) };
      if (enEdition) await api.put(`/directeur/alias/${enEdition.id}`, payload);
      else await api.post('/directeur/alias', payload);
      toast.succes(enEdition ? 'Alias mis à jour.' : 'Alias créé.');
      setModalOuvert(false);
      liste.recharger();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (alias) => {
    const ok = await supprimer(`Supprimer l’alias « ${alias.nom} » ?`, 'Supprimer l’alias');
    if (!ok) return;
    try {
      await api.delete(`/directeur/alias/${alias.id}`);
      toast.succes('Alias supprimé.');
      liste.recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Suppression impossible.'));
    }
  };

  const colonnes = [
    { cle: 'cycle_nom', titre: 'Cycle', rendu: (a) => <Badge couleur="bleu">{a.cycle_nom}</Badge> },
    { cle: 'classe_nom', titre: 'Classe', rendu: (a) => <strong>{a.classe_nom}</strong> },
    { cle: 'nom', titre: 'Alias', rendu: (a) => <strong>{a.nom}</strong> },
    { cle: 'capacite', titre: 'Capacité', largeur: 110, rendu: (a) => a.capacite ?? '—' },
    {
      cle: 'actions', titre: 'Actions', largeur: 180,
      rendu: (a) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => ouvrirEdition(a)}>Modifier</Button>
          <Button size="sm" variant="danger" onClick={() => retirer(a)}>Supprimer</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <h1 className="page-titre">Alias de classe</h1>
      <p className="text-doux mb-4" style={{ maxWidth: 760 }}>
        <strong>Facultatif.</strong> Les alias servent à diviser une classe (ex. « CP1 A », « CP1 B »). Si vous n’en créez aucun, chaque classe fonctionne comme un groupe unique — rien d’autre n’est à configurer.
      </p>
      <p className="text-doux mb-4">Sections/groupes d’une classe (ex : CP1 A, CP1 B). Respectez l’arborescence cycle → classe → alias.</p>
      <div className="flex-between mb-4 gap-3" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterBar>
          <SearchBar valeur={liste.search} onChange={liste.setSearch} placeholder="Rechercher un alias…" />
          <SelectFiltre label="Cycle" value={cycleFiltre} onChange={(e) => { setCycleFiltre(e.target.value); setClasseFiltre(''); }}>
            <option value="">Tous les cycles</option>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </SelectFiltre>
          <SelectFiltre label="Classe" value={classeFiltre} onChange={(e) => setClasseFiltre(e.target.value)}>
            <option value="">Toutes les classes</option>
            {classesFiltrees.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </SelectFiltre>
        </FilterBar>
        <Button onClick={ouvrirCreation}>+ Nouvel alias</Button>
      </div>
      <DataTable columns={colonnes} data={liste.items} enChargement={liste.enChargement} messageVide="Aucun alias de classe." />
      <Pagination page={liste.page} totalPages={liste.totalPages} total={liste.total} parPage={liste.parPage} onChangePage={liste.setPage} onChangeParPage={liste.setParPage} />

      {modalOuvert && (
        <Modal titre={enEdition ? 'Modifier l’alias' : 'Nouvel alias de classe'} onFermer={() => setModalOuvert(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setModalOuvert(false)}>Annuler</Button>
              <Button type="submit" form="form-alias" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          )}>
          <form id="form-alias" onSubmit={enregistrer}>
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            <Select label="Cycle" name="cycle" value={formCycle} onChange={(e) => { setFormCycle(e.target.value); setForm({ ...form, class_id: '' }); }} requis>
              <option value="">— Choisir un cycle —</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Select>
            <div className="mt-4">
              <Select label="Classe" name="class_id" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} requis disabled={!formCycle}>
                <option value="">— Choisir une classe —</option>
                {classesCascade.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </Select>
            </div>
            <div className="grid-2 mt-4">
              <Input label="Nom de l’alias" name="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex. CP1 A" requis />
              <Input label="Capacité (optionnel)" name="capacite" type="number" min="1" value={form.capacite} onChange={(e) => setForm({ ...form, capacite: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
