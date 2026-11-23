// Matières enseignées dans l'établissement.
// Partagé : Admin (CRUD), Secrétaire (création déléguée), Directeur (lecture seule).
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

export default function MatieresPage({ base = '/admin', lectureSeule = false }) {
  const toast = useToast();
  const { supprimer } = useConfirm();
  const liste = usePaginatedResource('/subjects');
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState({ nom: '', code: '' });

  const ouvrirCreation = () => { setEnEdition(null); setForm({ nom: '', code: '' }); setErreur(''); setModalOuvert(true); };
  const ouvrirEdition = (matiere) => { setEnEdition(matiere); setForm({ nom: matiere.nom, code: matiere.code || '' }); setErreur(''); setModalOuvert(true); };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const payload = { nom: form.nom.trim(), code: form.code.trim() || null };
      if (enEdition) await api.put(`${base}/subjects/${enEdition.id}`, payload);
      else await api.post(`${base}/subjects`, payload);
      toast.succes(enEdition ? 'Matière mise à jour.' : 'Matière créée.');
      setModalOuvert(false);
      liste.recharger();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (matiere) => {
    const ok = await supprimer(`Supprimer la matière « ${matiere.nom} » ?`, 'Supprimer la matière');
    if (!ok) return;
    try {
      await api.delete(`${base}/subjects/${matiere.id}`);
      toast.succes('Matière supprimée.');
      liste.recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Suppression impossible.'));
    }
  };

  const colonnes = [
    { cle: 'nom', titre: 'Matière', rendu: (m) => <strong>{m.nom}</strong> },
    { cle: 'code', titre: 'Code', largeur: 140, rendu: (m) => m.code || '—' },
    ...(lectureSeule ? [] : [{
      cle: 'actions', titre: 'Actions', largeur: 180,
      rendu: (m) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => ouvrirEdition(m)}>Modifier</Button>
          <Button size="sm" variant="danger" onClick={() => retirer(m)}>Supprimer</Button>
        </div>
      ),
    }]),
  ];

  return (
    <>
      <h1 className="page-titre">Matières de l’établissement</h1>
      <p className="text-doux mb-4">
        {lectureSeule
          ? 'Vue du Directeur : les matières sont créées par l’Administrateur ou par la Secrétaire (délégation). Les coefficients sont définis dans Affectations.'
          : 'Les coefficients sont définis par classe depuis Affectations (Directeur ou Secrétaire déléguée).'}
      </p>
      <div className="flex-between mb-4 gap-3" style={{ flexWrap: 'wrap' }}>
        <SearchBar valeur={liste.search} onChange={liste.setSearch} placeholder="Rechercher une matière…" />
        {!lectureSeule && <Button onClick={ouvrirCreation}>+ Nouvelle matière</Button>}
      </div>
      <DataTable columns={colonnes} data={liste.items} enChargement={liste.enChargement} messageVide="Aucune matière. Créez-en une." />
      <Pagination page={liste.page} totalPages={liste.totalPages} total={liste.total} parPage={liste.parPage} onChangePage={liste.setPage} onChangeParPage={liste.setParPage} />

      {modalOuvert && (
        <Modal titre={enEdition ? 'Modifier la matière' : 'Nouvelle matière'} onFermer={() => setModalOuvert(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setModalOuvert(false)}>Annuler</Button>
              <Button type="submit" form="form-matiere" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          )}>
          <form id="form-matiere" onSubmit={enregistrer}>
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            <Input label="Nom" name="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex. Mathématiques" requis autoFocus />
            <div className="mt-4"><Input label="Code (optionnel)" name="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ex. MATH" /></div>
          </form>
        </Modal>
      )}
    </>
  );
}
