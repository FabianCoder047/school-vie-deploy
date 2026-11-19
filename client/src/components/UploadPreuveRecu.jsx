// Preuve scannée du reçu (rempli à la main) — le secrétaire et le comptable
// joignent ici un scan/photo « en cas de quoi » (contrôle, litige…).
import { useRef, useState } from 'react';
import api, { messageErreur } from '../api/axios';
import Badge from './Badge';
import Button from './Button';

/** URL absolue d'un fichier /uploads/… (origine déduite de VITE_API_URL). */
export function urlUpload(chemin) {
  if (!chemin) return null;
  if (String(chemin).startsWith('http')) return chemin;
  const origine = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return `${origine}${chemin}`;
}

export default function UploadPreuveRecu({ base, paymentId, preuve, onChange, compact = false }) {
  const inputRef = useRef(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const envoyer = async (file) => {
    if (!file || !paymentId) return;
    setErreur('');
    setEnvoi(true);
    try {
      const fd = new FormData();
      fd.append('justificatif', file);
      const { data } = await api.post(`${base}/paiements/${paymentId}/justificatif`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange?.(data.justificatif_chemin || null);
    } catch (err) {
      setErreur(messageErreur(err, 'Envoi impossible.'));
    } finally {
      setEnvoi(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const retirer = async () => {
    setErreur('');
    setEnvoi(true);
    try {
      await api.delete(`${base}/paiements/${paymentId}/justificatif`);
      onChange?.(null);
    } catch (err) {
      setErreur(messageErreur(err, 'Suppression impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const url = urlUpload(preuve);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        aria-label="Choisir le scan du reçu"
        onChange={(e) => envoyer(e.target.files?.[0])}
      />
      {preuve ? (
        <>
          <Badge couleur="vert">Reçu scanné joint</Badge>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => window.open(url, '_blank', 'noopener')}>Voir</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()} disabled={envoi}>
            {envoi ? 'Envoi…' : 'Remplacer'}
          </button>
          {!compact && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={retirer} disabled={envoi}>Retirer</button>
          )}
        </>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()} disabled={envoi} title="Le reçu est rempli à la main — joindre ici le scan/photo (PDF, PNG, JPEG, WebP — 5 Mo max)">
          {envoi ? 'Envoi…' : 'Joindre le reçu scanné'}
        </button>
      )}
      {erreur && <span role="alert" style={{ color: 'var(--rouge-700)', fontSize: 12 }}>{erreur}</span>}
    </div>
  );
}
