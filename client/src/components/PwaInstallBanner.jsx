// Bannière d'installation PWA, affichée dès l'arrivée sur le site.
// Un seul clic sur la bannière déclenche le dialogue natif d'installation
// (Android / Chrome / Edge / PC). Les navigateurs interdisent l'installation
// silencieuse : un geste de l'utilisateur est toujours requis. Sur iOS, Safari
// n'expose pas ce dialogue → la bannière ouvre un guide « Partager → Ajouter ».
// Si l'utilisateur ferme la bannière, elle revient à la prochaine ouverture de
// l'application (masquage stocké en sessionStorage uniquement).
import { useEffect, useState } from 'react';
import SchoolLogo from './SchoolLogo';
import Modal from './Modal';
import Button from './Button';

const CLE_MASQUAGE = 'school-vie:pwa-banner-masquee';

export default function PwaInstallBanner({ dansDashboard = false }) {
  const [prompt, setPrompt] = useState(null);
  const [installee, setInstallee] = useState(false);
  const [estIos, setEstIos] = useState(false);
  const [guideOuvert, setGuideOuvert] = useState(false);
  const [masquee, setMasquee] = useState(() => {
    try { return sessionStorage.getItem(CLE_MASQUAGE) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const dejaInstallee = window.matchMedia?.('(display-mode: standalone)').matches
      || navigator.standalone === true;
    if (dejaInstallee) { setInstallee(true); return undefined; }

    setEstIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

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

  if (installee || masquee) return null;

  const installer = async () => {
    if (!prompt) { setGuideOuvert(true); return; }
    prompt.prompt();
    await prompt.userChoice; // 'accepted' ou 'dismissed' : la bannière reste
    setPrompt(null);
  };

  const fermer = (e) => {
    e?.stopPropagation();
    try { sessionStorage.setItem(CLE_MASQUAGE, '1'); } catch { /* ignore */ }
    setMasquee(true);
  };

  return (
    <>
      <div className={`pwa-banner${dansDashboard ? ' pwa-banner--dashboard' : ''}`}
        role="region" aria-label="Installer l’application School Vie"
        onClick={installer}>
        <div className="pwa-banner-logo"><SchoolLogo alt="Logo School Vie" /></div>
        <div className="pwa-banner-corps">
          <strong>Installer School Vie</strong>
          <span>Accès rapide depuis l’écran d’accueil, même hors ligne.</span>
        </div>
        <button type="button" className="btn btn-primary btn-sm pwa-banner-action" onClick={installer}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
          </svg>
          {prompt ? 'Installer' : 'Comment faire'}
        </button>
        <button type="button" className="pwa-banner-fermer" onClick={fermer} aria-label="Masquer la bannière">×</button>
      </div>

      {guideOuvert && (
        <Modal titre="Installer School Vie" onFermer={() => setGuideOuvert(false)}
          footer={<Button variant="secondary" onClick={() => setGuideOuvert(false)}>Compris</Button>}>
          <p className="text-doux">
            {estIos
              ? 'Sur iPhone / iPad, ouvrez cette page dans Safari, appuyez sur le bouton Partager (carré avec une flèche), puis choisissez « Sur l’écran d’accueil » et « Ajouter ». Safari ne permet pas l’installation automatique.'
              : 'Le dialogue d’installation s’ouvrira dès que votre navigateur le proposera (après quelques instants sur le site). Vous pouvez aussi utiliser le menu (⋮) → « Installer l’application » ou l’icône dans la barre d’adresse sur PC Chrome/Edge.'}
          </p>
          <p className="text-doux mt-4" style={{ fontSize: 12 }}>
            L’installation nécessite HTTPS (c’est le cas en production). Aucune donnée scolaire n’est stockée sur l’appareil.
          </p>
        </Modal>
      )}
    </>
  );
}
