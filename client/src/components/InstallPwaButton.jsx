// Bouton d'installation de la PWA.
//  - Android / Chrome / Edge / PC : on capture beforeinstallprompt et on
//    déclenche le dialogue natif d'installation au clic.
//  - iPhone / iPad / iPadOS : Safari n'émet pas beforeinstallprompt ; on
//    affiche donc un bouton qui explique « Partager → Sur l'écran d'accueil ».
// Le bouton disparaît si l'application tourne déjà en mode autonome (standalone).
import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export default function InstallPwaButton() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [estIos, setEstIos] = useState(false);
  const [guideOuvert, setGuideOuvert] = useState(false);

  useEffect(() => {
    const dejaInstallee = window.matchMedia?.('(display-mode: standalone)').matches
      || navigator.standalone === true;
    if (dejaInstallee) return undefined;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setEstIos(ios);
    if (ios) setVisible(true);

    const onBeforeInstall = (e) => {
      e.preventDefault(); // on garde le dialogue pour le déclencher au clic
      setPrompt(e);
      setVisible(true);
    };
    const onInstalled = () => { setVisible(false); setPrompt(null); };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible) return null;

  const installer = async () => {
    if (!prompt) { setGuideOuvert(true); return; }
    prompt.prompt();
    await prompt.userChoice;
    setVisible(false);
    setPrompt(null);
  };

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={installer}
        title="Installer School Vie sur cet appareil" aria-label="Installer School Vie sur cet appareil">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
        </svg>
        <span>Installer l’appli</span>
      </button>

      {guideOuvert && (
        <Modal titre="Installer School Vie" onFermer={() => setGuideOuvert(false)}
          footer={<Button variant="secondary" onClick={() => setGuideOuvert(false)}>Compris</Button>}>
          <p className="text-doux">
            {estIos
              ? 'Sur iPhone / iPad, ouvrez cette page dans Safari, appuyez sur le bouton Partager (carré avec une flèche), puis choisissez « Sur l’écran d’accueil » et « Ajouter ».'
              : 'Dans votre navigateur, ouvrez le menu (⋮) puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ». Sur PC Chrome/Edge, l’icône d’installation apparaît aussi dans la barre d’adresse.'}
          </p>
          <p className="text-doux mt-4" style={{ fontSize: 12 }}>
            L’installation nécessite une connexion HTTPS (c’est le cas en production). Les données restent sur le serveur : aucune donnée scolaire n’est stockée sur l’appareil.
          </p>
        </Modal>
      )}
    </>
  );
}
