// Bannière d'installation PWA, intégrée EN HAUT du contenu de la page.
// Le bouton n'est actif QUE lorsque le navigateur a émis beforeinstallprompt :
// un clic déclenche alors DIRECTEMENT l'installation sur l'appareil, sans guide.
// Sur iOS (Safari) l'installation programmatique est impossible : la bannière
// n'est pas affichée du tout plutôt que de proposer un bouton qui ne fait rien.
// Les navigateurs interdisent l'installation silencieuse : un geste (ce clic)
// reste obligatoire, mais il suffit.
import { useEffect, useState } from 'react';
import SchoolLogo from './SchoolLogo';

const CLE_MASQUAGE = 'school-vie:pwa-banner-masquee';

export default function PwaInstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [installee, setInstallee] = useState(false);
  const [supporte, setSupporte] = useState(false);
  const [masquee, setMasquee] = useState(() => {
    try { return sessionStorage.getItem(CLE_MASQUAGE) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const dejaInstallee = window.matchMedia?.('(display-mode: standalone)').matches
      || navigator.standalone === true;
    if (dejaInstallee) { setInstallee(true); return undefined; }

    // Safari/iOS et Firefox n'exposent pas beforeinstallprompt : on masque la
    // bannière au lieu d'afficher un bouton qui ne peut pas installer.
    if (!('onbeforeinstallprompt' in window)) return undefined;
    setSupporte(true);

    const onBeforeInstall = (e) => {
      e.preventDefault(); // on garde le dialogue pour le déclencher au clic
      setPrompt(e);
    };
    const onInstalled = () => { setInstallee(true); setPrompt(null); };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installee || masquee || !supporte) return null;

  const installer = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice; // 'accepted' → installée ; 'dismissed' → on garde la bannière
    setPrompt(null);
  };

  const fermer = () => {
    try { sessionStorage.setItem(CLE_MASQUAGE, '1'); } catch { /* ignore */ }
    setMasquee(true);
  };

  return (
    <div className="pwa-banner" role="region" aria-label="Installer l’application School Vie">
      <div className="pwa-banner-logo"><SchoolLogo alt="Logo School Vie" /></div>
      <div className="pwa-banner-corps">
        <strong>Installer School Vie</strong>
        <span>Accès rapide depuis l’écran d’accueil, même hors ligne.</span>
      </div>
      <button type="button" className="btn btn-primary btn-sm pwa-banner-action"
        onClick={installer} disabled={!prompt}
        title={prompt ? 'Installer School Vie sur cet appareil' : 'Le navigateur proposera l’installation dans quelques instants'}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
        </svg>
        {prompt ? 'Installer' : 'Installation…'}
      </button>
      <button type="button" className="pwa-banner-fermer" onClick={fermer} aria-label="Masquer la bannière">×</button>
    </div>
  );
}
