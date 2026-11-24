// Écran complet des comptes Directeurs (Admin) — calqué pour les
// utilisateurs de l'école côté Directeur via les props.
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
import Select from '../../components/Select';
import CodeCopiable from '../../components/CodeCopiable';

/**
 * @param {{ endpoint: string, rolesDisponibles: Array<{value:string,label:string}>, titre: string, permissions: 'admin' | 'directeur' }} props
 */
export default function AccountsManager({ endpoint, rolesDisponibles, titre, sousTitre }) {
  const toast = useToast();
  const { confirmer } = useConfirm();
  const liste = usePaginatedResource(endpoint);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ role: rolesDisponibles[0].value, nom: '', prenom: '', email: '', telephone: '' });
  const [identifiantsAffiches, setIdentifiantsAffiches] = useState(null);

  const resetForm = () => { setForm({ role: rolesDisponibles[0].value, nom: '', prenom: '', email: '', telephone: '' }); setErreur(''); };

  const creer = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const { data } = await api.post(endpoint, {
        role: form.role,
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim() || null,
        telephone: form.telephone.trim() || null,
      });
      setModalOuvert(false);
      resetForm();
      liste.recharger();
      if (data.motDePasseTemporaire) {
        setIdentifiantsAffiches({ nom: `${data.user.prenom} ${data.user.nom}`, email: data.user.email, telephone: data.user.telephone, motDePasse: data.motDePasseTemporaire, motif: data.mailEnvoye ? 'mail' : 'sans-mail' });
      } else {
        toast.succes('Compte créé. Les identifiants ont été envoyés par e-mail.');
      }
    } catch (err) {
      setErreur(messageErreur(err, 'Création impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const basculerStatut = async (compte) => {
    const action = compte.is_active ? 'désactiver' : 'activer';
    const ok = await confirmer({
      titre: `${compte.is_active ? 'Désactiver' : 'Activer'} le compte`,
      message: `Voulez-vous ${action} le compte de ${compte.prenom} ${compte.nom} ?`,
      texteConfirmer: compte.is_active ? 'Désactiver' : 'Activer',
      type: compte.is_active ? 'avertissement' : 'info',
    });
    if (!ok) return;
    try {
      await api.patch(`${endpoint}/${compte.id}/statut`, { is_active: !compte.is_active });
      toast.succes(compte.is_active ? 'Compte désactivé (sessions révoquées).' : 'Compte activé.');
      liste.recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Action impossible.'));
    }
  };

  const renvoyer = async (compte) => {
    const ok = await confirmer({
      titre: 'Renvoyer les identifiants',
      message: `Un nouveau mot de passe temporaire sera généré pour ${compte.prenom} ${compte.nom} et envoyé par e-mail. Les sessions en cours seront coupées. Continuer ?`,
      texteConfirmer: 'Renvoyer',
      type: 'avertissement',
    });
    if (!ok) return;
    try {
      const { data } = await api.post(`${endpoint}/${compte.id}/renvoyer-identifiants`);
      if (data.motDePasseTemporaire) {
        setIdentifiantsAffiches({ nom: `${compte.prenom} ${compte.nom}`, email: compte.email, telephone: compte.telephone, motDePasse: data.motDePasseTemporaire, motif: 'sans-mail' });
      } else {
        toast.succes('Identifiants renvoyés par e-mail.');
      }
    } catch (err) {
      toast.erreur(messageErreur(err, 'Envoi impossible.'));
    }
  };

  const colonnes = [
    { cle: 'nom', titre: 'Nom', rendu: (c) => <strong>{c.nom}</strong> },
    { cle: 'prenom', titre: 'Prénom' },
    { cle: 'role', titre: 'Rôle', rendu: (c) => <Badge couleur="bleu">{c.role}</Badge> },
    { cle: 'identifiant', titre: 'Identifiant', rendu: (c) => c.email || c.telephone },
    {
      cle: 'is_active', titre: 'Statut',
      rendu: (c) => c.is_active
        ? <Badge couleur="vert">Actif</Badge>
        : <Badge couleur="rouge">Désactivé</Badge>,
    },
    {
      cle: 'must_change_password', titre: '1ère connexion',
      rendu: (c) => c.must_change_password ? <Badge couleur="jaune">En attente</Badge> : <Badge couleur="gris">Effectuée</Badge>,
    },
    {
      cle: 'actions', titre: 'Actions', largeur: 220,
      rendu: (c) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => renvoyer(c)} title="Renvoyer les identifiants">Identifiants</Button>
          <Button size="sm" variant={c.is_active ? 'danger' : 'success'} onClick={() => basculerStatut(c)}>
            {c.is_active ? 'Désactiver' : 'Activer'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <h1 className="page-titre">{titre}</h1>
      {sousTitre && <p className="text-doux mb-4">{sousTitre}</p>}
      <div className="flex-between mb-4 gap-3" style={{ flexWrap: 'wrap' }}>
        <SearchBar valeur={liste.search} onChange={liste.setSearch} placeholder="Rechercher un nom, prénom, e-mail…" />
        <Button onClick={() => { resetForm(); setModalOuvert(true); }}>+ Nouveau compte</Button>
      </div>

      <DataTable columns={colonnes} data={liste.items} enChargement={liste.enChargement} messageVide="Aucun compte pour l’instant." />
      <Pagination page={liste.page} totalPages={liste.totalPages} total={liste.total} parPage={liste.parPage} onChangePage={liste.setPage} onChangeParPage={liste.setParPage} />

      {/* Modal de création */}
      {modalOuvert && (
        <Modal titre="Créer un compte" onFermer={() => setModalOuvert(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setModalOuvert(false)}>Annuler</Button>
              <Button type="submit" form="form-creer-compte" disabled={envoi}>{envoi ? 'Création…' : 'Créer le compte'}</Button>
            </>
          )}>
          <form id="form-creer-compte" onSubmit={creer}>
            {erreur && <div className="auth-erreur" role="alert">{erreur}</div>}
            <Select label="Rôle" name="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} requis>
              {rolesDisponibles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            <div className="grid-2 mt-4">
              <Input label="Nom" name="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} requis />
              <Input label="Prénom" name="prenom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} requis />
            </div>
            <div className="mt-4">
              <Input label="E-mail" name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ex. nom@example.com" />
            </div>
            <div className="mt-4">
              <Input label="Téléphone" name="telephone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="ex. 90 00 00 00" aide="Un e-mail ou un téléphone est requis." />
            </div>
            <p className="text-doux mt-4" style={{ fontSize: 12 }}>Un mot de passe par défaut sera généré et envoyé par e-mail ; le changement sera exigé à la première connexion.</p>
          </form>
        </Modal>
      )}

      {/* Modal d'affichage unique du mot de passe */}
      {identifiantsAffiches && (
        <Modal titre="Mot de passe temporaire (affiché une seule fois)" onFermer={() => setIdentifiantsAffiches(null)}
          footer={<Button variant="primary" onClick={() => setIdentifiantsAffiches(null)}>J’ai noté le mot de passe</Button>}>
          <div className="auth-erreur" style={{ marginBottom: 'var(--espace-4)' }}>
            Aucun e-mail n’a pu être envoyé. Transmettez ces identifiants au titulaire du compte (ce mot de passe ne sera plus jamais affiché) :
          </div>
          <div className="card" style={{ background: 'var(--gris-50)' }}>
            <p><strong>Titulaire :</strong> {identifiantsAffiches.nom}</p>
            <p className="mt-4"><strong>Identifiant :</strong> {identifiantsAffiches.email || identifiantsAffiches.telephone}</p>
            <p className="mt-4"><strong>Mot de passe temporaire :</strong></p>
            <div className="mt-4"><CodeCopiable valeur={identifiantsAffiches.motDePasse} /></div>
          </div>
        </Modal>
      )}
    </>
  );
}
