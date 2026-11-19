// Périodes d'évaluation (Trimestre 1/2/3 ou Semestre 1/2) et fenêtre de
// saisie des notes — création/édition/suppression (Directeur).
import { useEffect, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';

export default function PeriodesPage() {
  const toast = useToast();
  const { supprimer } = useConfirm();
  const [annee, setAnnee] = useState(null);
  const [periodes, setPeriodes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [formErreur, setFormErreur] = useState('');
  const [form, setForm] = useState({ libelle: '', ordre: 1, date_debut: '', date_fin: '', saisie_debut: '', saisie_fin: '' });

  const charger = () => {
    setChargement(true);
    api.get('/directeur/periodes')
      .then(({ data }) => { setAnnee(data.annee); setPeriodes(data.periodes || []); })
      .catch((err) => setErreur(messageErreur(err, 'Chargement impossible.')))
      .finally(() => setChargement(false));
  };

  useEffect(() => { charger(); }, []);

  const ouvrirCreation = () => {
    setEnEdition(null);
    setForm({ libelle: '', ordre: (periodes.length || 0) + 1, date_debut: '', date_fin: '', saisie_debut: '', saisie_fin: '' });
    setFormErreur('');
    setModalOuvert(true);
  };

  const ouvrirEdition = (p) => {
    setEnEdition(p);
    setForm({
      libelle: p.libelle,
      ordre: p.ordre,
      date_debut: String(p.date_debut).slice(0, 10),
      date_fin: String(p.date_fin).slice(0, 10),
      saisie_debut: p.saisie_debut ? new Date(p.saisie_debut).toISOString().slice(0, 16) : '',
      saisie_fin: p.saisie_fin ? new Date(p.saisie_fin).toISOString().slice(0, 16) : '',
    });
    setFormErreur('');
    setModalOuvert(true);
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setFormErreur('');
    setEnvoi(true);
    const payload = {
      libelle: form.libelle.trim(),
      ordre: Number(form.ordre),
      date_debut: form.date_debut,
      date_fin: form.date_fin,
      saisie_debut: form.saisie_debut || null,
      saisie_fin: form.saisie_fin || null,
    };
    try {
      if (enEdition) await api.put(`/directeur/periodes/${enEdition.id}`, payload);
      else await api.post('/directeur/periodes', payload);
      toast.succes(enEdition ? 'Période mise à jour.' : 'Période créée.');
      setModalOuvert(false);
      charger();
    } catch (err) {
      setFormErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (p) => {
    const ok = await supprimer(`Supprimer « ${p.libelle} » ?`, 'Supprimer la période');
    if (!ok) return;
    try {
      await api.delete(`/directeur/periodes/${p.id}`);
      toast.succes('Période supprimée.');
      charger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Suppression impossible.'));
    }
  };

  const colonnes = [
    { cle: 'ordre', titre: 'N°', largeur: 60 },
    { cle: 'libelle', titre: 'Période', rendu: (p) => <strong>{p.libelle}</strong> },
    { cle: 'dates', titre: 'Dates', rendu: (p) => `${new Date(p.date_debut).toLocaleDateString('fr-FR')} → ${new Date(p.date_fin).toLocaleDateString('fr-FR')}` },
    { cle: 'fenetre', titre: 'Fenêtre de saisie', rendu: (p) => (
        <div style={{ fontSize: 12 }}>
          <div>Du {p.saisie_debut ? new Date(p.saisie_debut).toLocaleString('fr-FR') : 'non définie'}</div>
          <div>au {p.saisie_fin ? new Date(p.saisie_fin).toLocaleString('fr-FR') : 'non définie'}</div>
        </div>
      ) },
    { cle: 'etat', titre: 'État', rendu: (p) => {
        const ouverte = p.fenetre?.ouverte;
        return ouverte ? <Badge couleur="vert">Ouverte</Badge> : <Badge couleur="rouge">Fermée</Badge>;
      } },
    {
      cle: 'actions', titre: 'Actions', largeur: 180,
      rendu: (p) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => ouvrirEdition(p)}>Modifier</Button>
          <Button size="sm" variant="danger" onClick={() => retirer(p)}>Supprimer</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <h1 className="page-titre">Périodes d’évaluation{annee ? ` — ${annee.libelle}` : ''}</h1>
      <p className="text-doux mb-4">
        Définissez les périodes (Trimestre 1, 2, 3 ou Semestre 1, 2) et la <strong>fenêtre de saisie des notes</strong> pour chacune.
        En dehors de cette fenêtre, les professeurs ne peuvent ni saisir ni modifier de notes (blocage API + interface).
        <strong> Une seule période peut être ouverte à la fois</strong> — les fenêtres ne se chevauchent jamais (validation automatique).
        Une période sans fenêtre définie est <strong>fermée par défaut</strong> : ouvrez la saisie explicitement.
      </p>
      {periodes.filter((p) => p.fenetre?.ouverte).length > 1 && (
        <div className="auth-erreur mb-4" role="alert">
          <strong>Attention : {periodes.filter((p) => p.fenetre?.ouverte).length} périodes sont ouvertes.</strong><br />
          Une seule période peut être ouverte à la fois — modifiez les fenêtres pour n’en garder qu’une (ex. fermez celle qui ne doit plus recevoir de notes).
        </div>
      )}
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      <div className="flex-between mb-4 gap-3" style={{ flexWrap: 'wrap' }}>
        <span />
        <Button onClick={ouvrirCreation}>+ Nouvelle période</Button>
      </div>
      <DataTable columns={colonnes} data={periodes} cleLigne="id" enChargement={chargement} messageVide="Aucune période. Créez la première." />

      {modalOuvert && (
        <Modal titre={enEdition ? 'Modifier la période' : 'Nouvelle période'} onFermer={() => setModalOuvert(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setModalOuvert(false)}>Annuler</Button>
              <Button type="submit" form="form-periode" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          )}>
          <form id="form-periode" onSubmit={enregistrer}>
            {formErreur && <div className="auth-erreur" role="alert">{formErreur}</div>}
            <div className="grid-2">
              <Input label="Libellé" name="libelle" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} placeholder="ex. Trimestre 1" requis autoFocus />
              <Input label="N° d'ordre" name="ordre" type="number" min="1" value={form.ordre} onChange={(e) => setForm({ ...form, ordre: e.target.value })} required />
            </div>
            <div className="grid-2 mt-4">
              <Input label="Début de la période" name="date_debut" type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} required />
              <Input label="Fin de la période" name="date_fin" type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} required />
            </div>
            <div className="grid-2 mt-4">
              <Input label="Ouverture de la saisie" name="saisie_debut" type="datetime-local" value={form.saisie_debut} onChange={(e) => setForm({ ...form, saisie_debut: e.target.value })} aide="Vide = pas d’ouverture" />
              <Input label="Fermeture de la saisie" name="saisie_fin" type="datetime-local" value={form.saisie_fin} onChange={(e) => setForm({ ...form, saisie_fin: e.target.value })} aide="Vide = pas de fermeture" />
            </div>
            <p className="text-doux mt-4" style={{ fontSize: 12 }}>Laissez les deux champs vides : la période reste <strong>fermée</strong>. Une seule période peut être ouverte à la fois — si la fenêtre chevauche celle d’une autre période, l’enregistrement est refusé. Toute écriture hors fenêtre est refusée côté API et masquée côté interface.</p>
          </form>
        </Modal>
      )}
    </>
  );
}
