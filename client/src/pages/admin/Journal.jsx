// Journal d'activités — toutes les activités de tout le monde (audit_logs).
// Lecture paginée avec filtres : recherche d'auteur, action, entité, période.
import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import FilterBar from '../../components/FilterBar';
import SearchBar from '../../components/SearchBar';
import SelectFiltre from '../../components/SelectFiltre';
import Input from '../../components/Input';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';

const ROLE_LABELS = { ADMIN: 'Admin', DIRECTEUR: 'Directeur', SECRETAIRE: 'Secrétaire', COMPTABLE: 'Comptable', PROFESSEUR: 'Professeur', PARENT: 'Parent' };
const ROLE_COULEURS = { ADMIN: 'bleu', DIRECTEUR: 'bleu', SECRETAIRE: 'vert', COMPTABLE: 'jaune', PROFESSEUR: 'bleu', PARENT: 'vert' };

export default function JournalPage({ base = '/admin' }) {
  const [actionFiltre, setActionFiltre] = useState('');
  const [entiteFiltre, setEntiteFiltre] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [actions, setActions] = useState([]);
  const [entites, setEntites] = useState([]);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get(`${base}/journal/filtres`)
      .then(({ data }) => { setActions(data.actions || []); setEntites(data.entities || []); })
      .catch(() => {});
  }, [base]);

  const liste = usePaginatedResource(`${base}/journal`, {
    ...(actionFiltre ? { action: actionFiltre } : {}),
    ...(entiteFiltre ? { entity: entiteFiltre } : {}),
    ...(dateDebut ? { date_debut: dateDebut } : {}),
    ...(dateFin ? { date_fin: dateFin } : {}),
  });

  const jsonOuTexte = (v) => (v == null ? '—' : typeof v === 'string' ? v : JSON.stringify(v, null, 2));

  const colonnes = [
    { cle: 'created_at', titre: 'Date', largeur: 150, rendu: (l) => new Date(l.created_at).toLocaleString('fr-FR') },
    {
      cle: 'utilisateur', titre: 'Utilisateur', rendu: (l) => (l.user_id
        ? <span>{l.prenom} {l.nom} <Badge couleur={ROLE_COULEURS[l.role] || 'bleu'}>{ROLE_LABELS[l.role] || l.role}</Badge></span>
        : <span className="text-doux">Compte supprimé</span>),
    },
    { cle: 'action', titre: 'Action', rendu: (l) => <code style={{ fontSize: 12 }}>{l.action}</code> },
    { cle: 'entity', titre: 'Entité', rendu: (l) => (l.entity ? `${l.entity}${l.entity_id ? ` #${l.entity_id}` : ''}` : '—') },
    { cle: 'ip_address', titre: 'IP', rendu: (l) => l.ip_address || '—' },
    { cle: 'detail', titre: '', largeur: 90, rendu: (l) => <Button variant="ghost" onClick={() => setDetail(l)}>Détail</Button> },
  ];

  const reinitialiser = () => {
    setActionFiltre(''); setEntiteFiltre(''); setDateDebut(''); setDateFin(''); liste.setSearch('');
  };

  return (
    <>
      <h1 className="page-titre">Journal d’activités</h1>
      <p className="text-doux mb-4">Toutes les activités de tout le monde (connexions, créations, modifications, paiements, impressions de documents, feu vert…).</p>

      <FilterBar>
        <SearchBar valeur={liste.search} onChange={liste.setSearch} placeholder="Rechercher un auteur (nom, prénom, e-mail)…" />
        <SelectFiltre label="Action" value={actionFiltre} onChange={(e) => setActionFiltre(e.target.value)}>
          <option value="">Toutes les actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </SelectFiltre>
        <SelectFiltre label="Entité" value={entiteFiltre} onChange={(e) => setEntiteFiltre(e.target.value)}>
          <option value="">Toutes les entités</option>
          {entites.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
        </SelectFiltre>
        <Input label="Du" name="date_debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} style={{ minWidth: 150 }} />
        <Input label="au" name="date_fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={{ minWidth: 150 }} />
        <Button variant="ghost" onClick={reinitialiser}>Réinitialiser</Button>
      </FilterBar>

      <DataTable columns={colonnes} data={liste.items} enChargement={liste.enChargement} messageVide="Aucune activité pour ces critères." />
      <Pagination page={liste.page} totalPages={liste.totalPages} total={liste.total} parPage={liste.parPage} onChangePage={liste.setPage} onChangeParPage={liste.setParPage} />

      {detail && (
        <Modal titre="Détail de l’activité" onFermer={() => setDetail(null)} taille="lg"
          footer={<Button variant="secondary" onClick={() => setDetail(null)}>Fermer</Button>}>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <Badge couleur="bleu">{detail.action}</Badge>
            {detail.entity && <Badge couleur="jaune">{detail.entity}{detail.entity_id ? ` #${detail.entity_id}` : ''}</Badge>}
            <span className="text-doux">{new Date(detail.created_at).toLocaleString('fr-FR')}{detail.ip_address ? ` — IP ${detail.ip_address}` : ''}</span>
          </div>
          <p className="mt-4"><strong>{detail.user_id ? `${detail.prenom} ${detail.nom}` : 'Compte supprimé'}</strong>{detail.role ? ` (${ROLE_LABELS[detail.role] || detail.role})` : ''}</p>
          <div className="grid-2 mt-4" style={{ alignItems: 'start' }}>
            <div>
              <p className="sidebar-section" style={{ paddingLeft: 0 }}>Avant</p>
              <pre style={{ background: 'var(--gris-50)', borderRadius: 'var(--rayon-sm)', padding: 'var(--espace-3)', fontSize: 12, overflow: 'auto', maxHeight: 280 }}>{jsonOuTexte(detail.old_values)}</pre>
            </div>
            <div>
              <p className="sidebar-section" style={{ paddingLeft: 0 }}>Après</p>
              <pre style={{ background: 'var(--gris-50)', borderRadius: 'var(--rayon-sm)', padding: 'var(--espace-3)', fontSize: 12, overflow: 'auto', maxHeight: 280 }}>{jsonOuTexte(detail.new_values)}</pre>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
