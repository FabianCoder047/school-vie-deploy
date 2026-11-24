// Bannière de mise à jour PWA. Apparaît quand le service worker détecte une
// nouvelle version. Le bouton « Mettre à jour » active la nouvelle version et
// recharge l'application — AUCUNE DÉSINSTALLATION N'EST NÉCESSAIRE.
import { useEffect, useState } from 'react';
import Button from './Button';

const CLE_REPORT = 'school-vie:pwa-update-reportee';

export default function PwaUpdateBanner() {
  const [update, setUpdate] = useState(null);
  const [reportee, setReportee] = useState(() => {
    try { return sessionStorage.getItem(CLE_REPORT) === '1'; } catch { return false; }
  });
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const surMiseAJour = (e) => {
      if (reportee) return;
      setUpdate(e.detail?.updateSW || null);
    };
    window.addEventListener('school-vie:pwa-update', surMiseAJour);
    return () => window.removeEventListener('school-vie:pwa-update', surMiseAJour);
  }, [reportee]);

  if (!update || reportee) return null;

  const appliquer = async () => {
    setEnCours(true);
    try {
      await update(); // active le nouveau SW puis recharge la page
    } catch (_err) {
      window.location.reload();
    }
  };

  const plusTard = () => {
    try { sessionStorage.setItem(CLE_REPORT, '1'); } catch { /* ignore */ }
    setReportee(true);
  };

  return (
    <div className="pwa-banner pwa-banner--update" role="status" aria-label="Mise à jour disponible">
      <div className="pwa-banner-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--jaune-700)' }}>
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />
        </svg>
      </div>
      <div className="pwa-banner-corps">
        <strong>Mise à jour disponible</strong>
        <span>Une nouvelle version de School Vie est prête.</span>
      </div>
      <Button variant="primary" size="sm" className="pwa-banner-action" onClick={appliquer} disabled={enCours}>
        {enCours ? 'Mise à jour…' : 'Mettre à jour'}
      </Button>
      <Button variant="ghost" size="sm" onClick={plusTard} disabled={enCours}>Plus tard</Button>
    </div>
  );
}
