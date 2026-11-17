// Aperçu d'un PDF (authentifié) DANS l'application, avant impression.
// Récupère le document via l'API (blob), l'affiche dans une <iframe> avec
// boutons Imprimer / Ouvrir dans un onglet / Télécharger / Fermer.
import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import Modal from './Modal';
import Button from './Button';

export default function ApercuPdf({ titre = 'Aperçu du document', url, onFermer }) {
  const [etat, setEtat] = useState('chargement'); // 'chargement' | 'pret' | 'erreur'
  const [blobUrl, setBlobUrl] = useState(null);
  const [message, setMessage] = useState('');
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!url) return undefined;
    let actif = true;
    let objetUrl = null;
    setEtat('chargement');
    setMessage('');
    api.get(url, { responseType: 'blob' })
      .then(({ data }) => {
        if (!actif) return;
        objetUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
        setBlobUrl(objetUrl);
        setEtat('pret');
      })
      .catch(async (err) => {
        if (!actif) return;
        // L'erreur peut être un blob JSON (message ApiError) → tenter de le lire.
        let msg = 'Le document n’a pas pu être généré.';
        const data = err?.response?.data;
        if (data instanceof Blob && data.type?.includes('json')) {
          try {
            const json = JSON.parse(await data.text());
            msg = json?.message || msg;
          } catch { /* ignorer */ }
        } else if (data?.message) {
          msg = data.message;
        }
        setMessage(msg);
        setEtat('erreur');
      });
    return () => {
      actif = false;
      if (objetUrl) URL.revokeObjectURL(objetUrl);
    };
  }, [url]);

  const imprimer = () => {
    const cadre = iframeRef.current;
    if (!cadre?.contentWindow) return;
    try {
      cadre.contentWindow.focus();
      cadre.contentWindow.print();
    } catch {
      window.open(blobUrl, '_blank', 'noopener');
    }
  };

  const telecharger = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${titre.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    a.click();
  };

  return (
    <Modal
      titre={titre}
      onFermer={onFermer}
      taille="xl"
      footer={(
        <>
          <Button variant="secondary" onClick={onFermer}>Fermer</Button>
          {etat === 'pret' && (
            <>
              <Button variant="ghost" onClick={telecharger}>Télécharger</Button>
              <Button variant="ghost" onClick={() => window.open(blobUrl, '_blank', 'noopener')}>Nouvel onglet</Button>
              <Button variant="primary" onClick={imprimer}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7M6 18H3a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-3"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
                Imprimer
              </Button>
            </>
          )}
        </>
      )}
    >
      {etat === 'chargement' && (
        <div className="apercu-pdf-etat" role="status">
          <div className="spinner" style={{ width: 34, height: 34, borderWidth: 4 }} />
          <p>Génération du document…</p>
        </div>
      )}
      {etat === 'erreur' && (
        <div className="apercu-pdf-etat" role="alert">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--rouge-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9.5"/></svg>
          <p className="text-doux">{message}</p>
        </div>
      )}
      {etat === 'pret' && (
        <iframe ref={iframeRef} src={blobUrl} title={titre} className="apercu-pdf" />
      )}
    </Modal>
  );
}
