// Mon profil — chaque rôle peut consulter/modifier ses infos et changer son mot de passe.
import { useEffect, useRef, useState } from 'react';
import api, { messageErreur } from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import PasswordInput from '../components/PasswordInput';
import SignaturePad from '../components/SignaturePad';
import { KeyIcon } from '../components/icons';

const ORIGINE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const REGLES = [
  { id: 'longueur', label: 'Au moins 8 caractères', test: (v) => v.length >= 8 },
  { id: 'minuscule', label: 'Une minuscule', test: (v) => /[a-z]/.test(v) },
  { id: 'majuscule', label: 'Une majuscule', test: (v) => /[A-Z]/.test(v) },
  { id: 'chiffre', label: 'Un chiffre', test: (v) => /[0-9]/.test(v) },
];

const ROLE_LIB = {
  ADMIN: 'Administrateur',
  DIRECTEUR: 'Directeur',
  SECRETAIRE: 'Secrétaire',
  COMPTABLE: 'Comptable',
  PROFESSEUR: 'Professeur',
  PARENT: 'Parent',
};

export default function ProfilPage() {
  const toast = useToast();
  const { supprimer } = useConfirm();
  const { user, changerMotDePasse } = useAuth();
  const estDirecteur = user?.role === 'DIRECTEUR';

  const [chargement, setChargement] = useState(true);
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', telephone: '' });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  // Signature du directeur (cartes scolaires) : vue / édition
  const [signaturePath, setSignaturePath] = useState(null);
  const [modeSignature, setModeSignature] = useState('view');
  const [chargeSignature, setChargeSignature] = useState(false);
  const uploadRef = useRef(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreurMdp, setErreurMdp] = useState('');
  const [envoiMdp, setEnvoiMdp] = useState(false);

  const charger = () => {
    setChargement(true);
    api.get('/profile')
      .then(({ data }) => setForm({
        nom: data.user.nom || '',
        prenom: data.user.prenom || '',
        email: data.user.email || '',
        telephone: data.user.telephone || '',
      }))
      .catch((err) => setErreur(messageErreur(err, 'Chargement impossible.')))
      .finally(() => setChargement(false));
  };

  useEffect(() => { charger(); }, []);
  useEffect(() => {
    if (!estDirecteur) return undefined;
    let actif = true;
    api.get('/parametres').then(({ data }) => { if (actif) setSignaturePath(data.signature_path || null); }).catch(() => {});
    return () => { actif = false; };
  }, [estDirecteur]);

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      await api.put('/profile', {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim() || null,
        telephone: form.telephone.trim() || null,
      });
      toast.succes('Profil enregistré.');
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const changerMdp = async (e) => {
    e.preventDefault();
    setErreurMdp('');
    if (!REGLES.every((r) => r.test(newPassword))) {
      setErreurMdp('Le nouveau mot de passe ne respecte pas toutes les règles.');
      return;
    }
    if (newPassword !== confirmation) {
      setErreurMdp('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setEnvoiMdp(true);
    try {
      await changerMotDePasse(currentPassword, newPassword);
      toast.succes('Mot de passe mis à jour.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } catch (err) {
      setErreurMdp(err?.response?.data?.message || 'Impossible de changer le mot de passe.');
    } finally {
      setEnvoiMdp(false);
    }
  };

  const enregistrerSignatureDessinee = async (dataUrl) => {
    setChargeSignature(true);
    try {
      const { data } = await api.post('/directeur/signature', { image: dataUrl });
      setSignaturePath(data.signature_path);
      setModeSignature('view');
      toast.succes('Signature enregistrée.');
    } catch (err) {
      toast.erreur(messageErreur(err, 'Impossible d’enregistrer la signature.'));
    } finally {
      setChargeSignature(false);
    }
  };

  const enregistrerSignatureUploadee = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const donnees = new FormData();
    donnees.append('signature', fichier);
    setChargeSignature(true);
    try {
      const { data } = await api.post('/directeur/signature/image', donnees, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSignaturePath(data.signature_path);
      setModeSignature('view');
      toast.succes('Signature enregistrée.');
    } catch (err) {
      toast.erreur(messageErreur(err, 'Envoi de la signature impossible.'));
    } finally {
      setChargeSignature(false);
      e.target.value = '';
    }
  };

  const retirerSignature = async () => {
    const ok = await supprimer('Retirer votre signature des cartes scolaires ?', 'Retirer la signature');
    if (!ok) return;
    try {
      await api.delete('/directeur/signature');
      setSignaturePath(null);
      toast.succes('Signature retirée.');
    } catch (err) {
      toast.erreur(messageErreur(err, 'Impossible de retirer la signature.'));
    }
  };

  const initiales = `${(user?.prenom?.[0] || '?').toUpperCase()}${(user?.nom?.[0] || '').toUpperCase()}`;

  return (
    <>
      <h1 className="page-titre">Mon profil</h1>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      {/* En-tête identité */}
      <Card className="mb-4">
        {chargement ? <div className="spinner" /> : (
          <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 84, height: 84, borderRadius: 'var(--rayon-md)', background: 'var(--bleu-100)', color: 'var(--bleu-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26 }}>{initiales}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 19 }}>{user?.prenom} {user?.nom}</div>
              <div className="text-doux">{user?.email || user?.telephone}</div>
              <span className="badge badge-bleu" style={{ marginTop: 6 }}>{ROLE_LIB[user?.role] || user?.role}</span>
            </div>
          </div>
        )}
      </Card>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* ===== Infos personnelles ===== */}
        <Card titre="Informations personnelles">
          <form onSubmit={enregistrer}>
            <div className="grid-2">
              <Input label="Prénom" name="prenom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} requis />
              <Input label="Nom" name="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} requis />
            </div>
            <div className="mt-4">
              <Input label="Adresse e-mail" name="email" type="email" value={form.email} disabled
                aide="L’adresse e-mail est votre identifiant de connexion : elle n’est pas modifiable ici." />
            </div>
            <div className="mt-4"><Input label="Téléphone" name="telephone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="ex. 90 00 00 00" aide="Un e-mail ou un téléphone est requis (identifiant de connexion)." /></div>
            <Button type="submit" className="mt-6" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </form>
        </Card>

        {/* ===== Mot de passe ===== */}
        <Card titre="Changer le mot de passe">
          <form onSubmit={changerMdp}>
            {erreurMdp && <div className="auth-erreur" role="alert">{erreurMdp}</div>}
            <PasswordInput label="Mot de passe actuel" name="currentPassword" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} requis />
            <div className="mt-4"><PasswordInput label="Nouveau mot de passe" name="newPassword" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} requis /></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
              {REGLES.map((regle) => {
                const ok = regle.test(newPassword);
                return <li key={regle.id} style={{ fontSize: 12, color: ok ? 'var(--vert-700)' : 'var(--gris-500)' }}>{ok ? '✓' : '○'} {regle.label}</li>;
              })}
            </ul>
            <div className="mt-4"><PasswordInput label="Confirmer le nouveau mot de passe" name="confirmation" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} requis /></div>
            <Button type="submit" className="mt-6 auth-bouton" disabled={envoiMdp}><KeyIcon size={16} />{envoiMdp ? 'Enregistrement…' : 'Changer le mot de passe'}</Button>
          </form>
        </Card>
      </div>

      {/* ===== Signature du directeur (cartes scolaires) — réservée au rôle DIRECTEUR ===== */}
      {estDirecteur && (
        <Card titre="Ma signature (cartes scolaires)" className="mt-4">
          <p className="text-doux">Apposée au dos des cartes scolaires, au-dessus de la ligne « Le Directeur ». Dessinez-la ci-dessous (souris ou doigt), ou uploadez-la si vous n’arrivez pas à signer à la main — le cachet est réglé par l’établissement, la signature ne le remplace pas.</p>
          {signaturePath && modeSignature === 'view' ? (
            <div className="mt-4" style={{ textAlign: 'center' }}>
              <div style={{ width: 260, height: 110, margin: '0 auto', border: '1px dashed var(--bordure)', borderRadius: 'var(--rayon-md)', background: 'var(--gris-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img src={signaturePath.startsWith('http') ? signaturePath : `${ORIGINE}${signaturePath}`} alt="Votre signature" style={{ maxWidth: '92%', maxHeight: '92%', objectFit: 'contain' }} />
              </div>
              <div className="flex gap-2 mt-4" style={{ justifyContent: 'center' }}>
                <Button variant="secondary" onClick={() => setModeSignature('edit')}>Refaire la signature</Button>
                <Button variant="ghost" onClick={() => uploadRef.current?.click()}>Uploader à la place</Button>
                <Button variant="danger" onClick={retirerSignature}>Retirer</Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <SignaturePad onSave={enregistrerSignatureDessinee} onCancel={signaturePath ? () => setModeSignature('view') : null} />
              <div className="flex gap-3 mt-4" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <span className="text-doux" style={{ fontSize: 12 }}>… ou si vous n’y arrivez pas à la main :</span>
                <Button variant="secondary" onClick={() => uploadRef.current?.click()} disabled={chargeSignature}>Uploader ma signature</Button>
              </div>
              {chargeSignature && <p className="text-doux mt-4">Enregistrement…</p>}
            </div>
          )}
          <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={enregistrerSignatureUploadee} />
        </Card>
      )}
    </>
  );
}
