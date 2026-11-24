import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { MaintenanceProvider } from './context/MaintenanceContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/maintenance.css';

// PWA : service worker enregistré dès le chargement (HTTPS requis sauf en
// local). Avec registerType 'prompt', on prévient l'application qu'une mise à
// jour est prête ; la bannière PwaUpdateBanner propose alors de l'appliquer.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('school-vie:pwa-update', { detail: { updateSW } }));
  },
});

// Une appli déjà installée ne vérifie pas toujours les mises à jour au
// lancement : on force une vérification au démarrage puis toutes les minutes.
navigator.serviceWorker?.ready.then((registration) => {
  registration.update().catch(() => {});
  window.setInterval(() => registration.update().catch(() => {}), 60_000);
}).catch(() => {});

// Certains navigateurs émettent beforeinstallprompt AVANT le montage de React :
// on le capture ici, au tout début, pour que le bouton puisse toujours ouvrir
// le dialogue d'installation natif au premier clic.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__schoolVieInstallPrompt = e;
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <MaintenanceProvider>
              <App />
            </MaintenanceProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
