// Paramètres de l'établissement — réservés au Directeur (logo + identité + cachet).
import { useEffect, useRef, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';

const URL_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ORIGINE = URL_API.replace(/\/api\/?$/, '');

const LIGNES_DELEGATION = [
  {
    cle: 'matieres_secretaire_autorisee',
    titre: 'Création des matières — Secrétaire',
    desc: 'La Secrétaire peut créer, modifier et supprimer les matières.',
  },
  {
    cle: 'affectations_secretaire_autorisee',
    titre: 'Affectations matière ↔ classe et professeur — Secrétaire',
    desc: 'La Secrétaire peut affecter les matières aux classes (coefficients) et les professeurs aux classes/matières.',
  },
  {
    cle: 'annees_secretaire_autorisee',
    titre: 'Années académiques — Secrétaire',
    desc: 'La Secrétaire peut créer les années et définir l’année courante. Désactivée : vous seul le pouvez.',
  },
  {
    cle: 'inscriptions_comptable_autorisee',
    titre: 'Inscriptions — Comptable',
    desc: 'À activer en votre absence : le Comptable peut inscrire un élève et enregistrer les frais d’inscription.',
  },
  {
    cle: 'paiements_secretaire_autorisee',
    titre: 'Paiements de scolarité — Secrétaire',
    desc: 'À activer en votre absence : la Secrétaire peut encaisser et annuler les paiements de scolarité.',
  },
];

export default function ParametresPage() {
  const toast = useToast();
  const inputLogoRef = useRef(null);
  const [form, setForm] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [apercuLogo, setApercuLogo] = useState(null);
  const [envoiLogo, setEnvoiLogo] = useState(false);
  const inputCachetRef = useRef(null);
  const [apercuCachet, setApercuCachet] = useState(null);
  const [envoiCachet, setEnvoiCachet] = useState(false);

  /* Délégations de tâches (chaque bascule est journalisée côté API) */
  const [delegations, setDelegations] = useState(null);
  const [envoiDelegations, setEnvoiDelegations] = useState(false);

  const charger = () => api.get('/parametres').then(({ data }) => setForm({
    nom: data.nom || '',
    adresse: data.adresse || '',
    bp: data.bp || '',
    ville: data.ville || '',
    pays: data.pays || '',
    telephone: data.telephone || '',
    email: data.email || '',
    directeur_nom: data.directeur_nom || '',
    cachet_path: data.cachet_path || null,
    devise: data.devise || 'FCFA',
    note_max: data.note_max ?? 20,
    duree_heure_minutes: data.duree_heure_minutes ?? 55,
    debut_journee: String(data.debut_journee || '07:00').slice(0, 5),
    pause_matin_debut: String(data.pause_matin_debut || '09:45').slice(0, 5),
    pause_matin_fin: String(data.pause_matin_fin || '10:10').slice(0, 5),
    fin_matin: String(data.fin_matin || '12:00').slice(0, 5),
    debut_apres_midi: String(data.debut_apres_midi || '14:30').slice(0, 5),
    fin_apres_midi: String(data.fin_apres_midi || '17:30').slice(0, 5),
    fin_primaire: String(data.fin_primaire || '11:30').slice(0, 5),
    logo_path: data.logo_path || null,
  })).catch((err) => setErreur(messageErreur(err, 'Chargement impossible.')));

  useEffect(() => { charger(); }, []);
  useEffect(() => {
    api.get('/directeur/delegations').then(({ data }) => setDelegations(data || {})).catch(() => {});
  }, []);

  const enregistrerDelegations = async () => {
    setEnvoiDelegations(true);
    setErreur('');
    try {
      const { data } = await api.put('/directeur/delegations', delegations);
      setDelegations(data);
      toast.succes('Délégations enregistrées et journalisées.');
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement des délégations impossible.'));
    } finally {
      setEnvoiDelegations(false);
    }
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      await api.put('/directeur/parametres', {
        nom: form.nom.trim(),
        adresse: form.adresse.trim() || null,
        bp: form.bp.trim() || null,
        ville: form.ville.trim() || null,
        pays: form.pays.trim() || null,
        telephone: form.telephone.trim() || null,
        email: form.email.trim() || null,
        directeur_nom: form.directeur_nom.trim() || null,
        devise: form.devise.trim() || 'FCFA',
        note_max: Number(form.note_max),
        duree_heure_minutes: Number(form.duree_heure_minutes),
        debut_journee: form.debut_journee,
        pause_matin_debut: form.pause_matin_debut,
        pause_matin_fin: form.pause_matin_fin,
        fin_matin: form.fin_matin,
        debut_apres_midi: form.debut_apres_midi,
        fin_apres_midi: form.fin_apres_midi,
        fin_primaire: form.fin_primaire,
      });
      toast.succes('Paramètres enregistrés.');
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const choisirLogo = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setApercuLogo(URL.createObjectURL(fichier));
    const donnees = new FormData();
    donnees.append('logo', fichier);
    setEnvoiLogo(true);
    setErreur('');
    try {
      const { data } = await api.post('/directeur/parametres/logo', donnees, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((f) => ({ ...f, logo_path: data.logo_path }));
      toast.succes('Logo mis à jour.');
    } catch (err) {
      setErreur(messageErreur(err, 'Envoi du logo impossible.'));
    } finally {
      setEnvoiLogo(false);
      e.target.value = '';
    }
  };

  // Signature du directeur / cachet : même logique que le logo
  const choisirImage = ({ champ, urlApi, champFichier, setApercu, setEnvoi, messageSucces, messageErreur: erreurMsg }) => async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setApercu(URL.createObjectURL(fichier));
    const donnees = new FormData();
    donnees.append(champFichier, fichier);
    setEnvoi(true);
    setErreur('');
    try {
      const { data } = await api.post(urlApi, donnees, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((f) => ({ ...f, [champ]: data[champ] }));
      toast.succes(messageSucces);
    } catch (err) {
      setErreur(messageErreur(err, erreurMsg));
    } finally {
      setEnvoi(false);
      e.target.value = '';
    }
  };
  const supprimerImage = ({ champ, urlApi, setApercu, messageSucces }) => async () => {
    setErreur('');
    try {
      await api.delete(urlApi);
      setForm((f) => ({ ...f, [champ]: null }));
      setApercu(null);
      toast.succes(messageSucces);
    } catch (err) {
      setErreur(messageErreur(err, 'Suppression impossible.'));
    }
  };
  const choisirCachet = choisirImage({ champ: 'cachet_path', urlApi: '/directeur/parametres/cachet', champFichier: 'cachet', setApercu: setApercuCachet, setEnvoi: setEnvoiCachet, messageSucces: 'Cachet mis à jour.', messageErreur: 'Envoi du cachet impossible.' });
  const retirerCachet = supprimerImage({ champ: 'cachet_path', urlApi: '/directeur/parametres/cachet', setApercu: setApercuCachet, messageSucces: 'Cachet retiré.' });

  if (!form) {
    return (
      <>
        <h1 className="page-titre">Paramètres de l’établissement</h1>
        {erreur ? <div className="auth-erreur" role="alert">{erreur}</div> : <div className="spinner" />}
      </>
    );
  }

  const logoUrl = form.logo_path ? (form.logo_path.startsWith('http') ? form.logo_path : `${ORIGINE}${form.logo_path}`) : null;
  const cachetUrl = form.cachet_path ? (form.cachet_path.startsWith('http') ? form.cachet_path : `${ORIGINE}${form.cachet_path}`) : null;

  return (
    <>
      <h1 className="page-titre">Paramètres de l’établissement</h1>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="flex" style={{ flexDirection: 'column', gap: 'var(--espace-5)' }}>
        {/* Identité */}
        <Card titre="Identité de l’école">
          <form id="form-parametres" onSubmit={enregistrer}>
            <Input label="Nom de l’école" name="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} requis />
            <Input label="Adresse" name="adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} placeholder="ex. Quartier…" />
            <div className="grid-2 mt-4">
              <Input label="Boîte postale (BP)" name="bp" value={form.bp} onChange={(e) => setForm({ ...form, bp: e.target.value })} placeholder="ex. 1207" aide="Affichée sur les cartes scolaires" />
              <Input label="Téléphone" name="telephone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
            <div className="grid-2 mt-4">
              <Input label="Ville" name="ville" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="ex. Lomé" />
              <Input label="Pays" name="pays" value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} placeholder="ex. TOGO" />
            </div>
            <div className="grid-2 mt-4">
              <Input label="E-mail" name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Devise" name="devise" value={form.devise} onChange={(e) => setForm({ ...form, devise: e.target.value })} aide="ex. FCFA" />
            </div>
            <div className="grid-2 mt-4">
              <Input label="Note maximale" name="note_max" type="number" min="1" step="0.5" value={form.note_max} onChange={(e) => setForm({ ...form, note_max: e.target.value })} />
              <Input label="Durée d’une heure de cours (minutes)" name="duree_heure_minutes" type="number" min="1" value={form.duree_heure_minutes} onChange={(e) => setForm({ ...form, duree_heure_minutes: e.target.value })} aide="55 minutes par défaut" />
            </div>
            <div className="mt-4">
              <Input label="Nom du directeur" name="directeur_nom" value={form.directeur_nom} onChange={(e) => setForm({ ...form, directeur_nom: e.target.value })} placeholder="ex. Kossivi AGBEKODO" aide="Utilisé au dos des cartes scolaires (« Je soussigné … »)" />
            </div>
            <Button type="submit" variant="primary" className="mt-6" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </form>
        </Card>

        {/* Délégations de tâches — pilotées par le Directeur et journalisées */}
        <Card titre="Délégations de tâches">
          <p className="text-doux">
            Activez une tâche pour la confier à un autre membre du personnel. Chaque activation,
            désactivation et action réalisée est consignée dans le journal d’activités.
          </p>
          {delegations ? (
            <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
              {LIGNES_DELEGATION.map((ligne) => (
                <label key={ligne.cle} className="flex-between" style={{ gap: 12, cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--bordure)' }}>
                  <span>
                    <strong style={{ fontSize: 14 }}>{ligne.titre}</strong>
                    <span className="text-doux" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>{ligne.desc}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(delegations[ligne.cle])}
                    onChange={(e) => setDelegations({ ...delegations, [ligne.cle]: e.target.checked })}
                    style={{ width: 18, height: 18, flexShrink: 0, cursor: 'pointer' }}
                    aria-label={ligne.titre}
                  />
                </label>
              ))}
              <Button className="mt-4" onClick={enregistrerDelegations} disabled={envoiDelegations}>
                {envoiDelegations ? 'Enregistrement…' : 'Enregistrer les délégations'}
              </Button>
            </div>
          ) : <div className="spinner" style={{ margin: '16px auto' }} />}
        </Card>
        </div>

        {/* Colonne droite : horaires (à droite des délégations), puis logo et cachet */}
        <div className="flex" style={{ flexDirection: 'column', gap: 'var(--espace-5)' }}>
        {/* Horaires de l'emploi du temps */}
        <Card titre="Horaires de l’emploi du temps">
          <p className="text-doux">Utilisés pour créer et valider les créneaux : un cours d’une heure dure {form.duree_heure_minutes} minutes, avec une pause le matin et un retour l’après-midi.</p>
          <div className="grid-2 mt-4">
            <Input label="Début des cours" name="debut_journee" type="time" form="form-parametres" value={form.debut_journee} onChange={(e) => setForm({ ...form, debut_journee: e.target.value })} />
            <Input label="Durée d’une heure (min)" name="duree_heure_minutes2" type="number" min="1" form="form-parametres" value={form.duree_heure_minutes} onChange={(e) => setForm({ ...form, duree_heure_minutes: e.target.value })} />
          </div>
          <div className="grid-2 mt-4">
            <Input label="Début de la pause" name="pause_matin_debut" type="time" form="form-parametres" value={form.pause_matin_debut} onChange={(e) => setForm({ ...form, pause_matin_debut: e.target.value })} />
            <Input label="Fin de la pause" name="pause_matin_fin" type="time" form="form-parametres" value={form.pause_matin_fin} onChange={(e) => setForm({ ...form, pause_matin_fin: e.target.value })} />
          </div>
          <div className="grid-2 mt-4">
            <Input label="Fin de la matinée" name="fin_matin" type="time" form="form-parametres" value={form.fin_matin} onChange={(e) => setForm({ ...form, fin_matin: e.target.value })} />
            <Input label="Fin au primaire" name="fin_primaire" type="time" form="form-parametres" value={form.fin_primaire} onChange={(e) => setForm({ ...form, fin_primaire: e.target.value })} aide="Durée libre au primaire, cours possibles aussi l’après-midi" />
          </div>
          <div className="grid-2 mt-4">
            <Input label="Retour des collégiens / lycéens" name="debut_apres_midi" type="time" form="form-parametres" value={form.debut_apres_midi} onChange={(e) => setForm({ ...form, debut_apres_midi: e.target.value })} />
            <Input label="Fin de l’après-midi" name="fin_apres_midi" type="time" form="form-parametres" value={form.fin_apres_midi} onChange={(e) => setForm({ ...form, fin_apres_midi: e.target.value })} />
          </div>
          <Button type="submit" form="form-parametres" variant="secondary" className="mt-4" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer les horaires'}</Button>
        </Card>

        {/* Logo */}
        <Card titre="Logo de l’école">
          <p className="text-doux">Utilisé sur la sidebar, les pages d’authentification, les cartes scolaires et les bulletins. PNG, JPEG ou WebP — 2 Mo maximum.</p>
          <div style={{ textAlign: 'center', padding: 'var(--espace-5) 0' }}>
            <div style={{ width: 160, height: 120, margin: '0 auto', border: '1px dashed var(--bordure)', borderRadius: 'var(--rayon-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gris-50)', overflow: 'hidden' }}>
              {(apercuLogo || logoUrl) ? (
                <img src={apercuLogo || logoUrl} alt="Logo de l’école" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span className="text-doux">Aucun logo</span>
              )}
            </div>
            <input ref={inputLogoRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={choisirLogo} />
            <Button variant="secondary" className="mt-4" onClick={() => inputLogoRef.current?.click()} disabled={envoiLogo}>
              {envoiLogo ? 'Envoi…' : 'Choisir un logo'}
            </Button>
          </div>
        </Card>

        {/* Cachet de l'établissement */}
        <Card titre="Cachet de l’établissement">
          <p className="text-doux">Apposé au dos des cartes scolaires, dans le cercle pointillé à gauche. Fond transparent recommandé (PNG). PNG, JPEG ou WebP — 2 Mo max.</p>
          <div style={{ textAlign: 'center', padding: 'var(--espace-5) 0' }}>
            <div style={{ width: 130, height: 130, margin: '0 auto', border: '1px dashed var(--bordure)', borderRadius: 'var(--rayon-plein)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gris-50)', overflow: 'hidden' }}>
              {(apercuCachet || cachetUrl) ? (
                <img src={apercuCachet || cachetUrl} alt="Cachet de l’établissement" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
              ) : (
                <span className="text-doux">Aucun cachet</span>
              )}
            </div>
            <input ref={inputCachetRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={choisirCachet} />
            <div className="flex gap-2 mt-4" style={{ justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => inputCachetRef.current?.click()} disabled={envoiCachet}>
                {envoiCachet ? 'Envoi…' : 'Choisir un cachet'}
              </Button>
              {cachetUrl && <Button variant="danger" onClick={retirerCachet}>Retirer</Button>}
            </div>
          </div>
        </Card>
        </div>
      </div>
    </>
  );
}
