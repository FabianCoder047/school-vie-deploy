import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Mise à jour automatique du service worker à chaque déploiement.
      registerType: 'autoUpdate',
      // Enregistrement explicite dans main.jsx (permet de piloter l'update).
      injectRegister: false,
      includeAssets: ['favicon.svg', 'pwa/favicon-32.png', 'pwa/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'School Vie — Gestion d’établissement scolaire',
        short_name: 'School Vie',
        description:
          'School Vie — gestion complète d’un établissement scolaire : inscriptions, notes, paiements, emploi du temps.',
        lang: 'fr',
        theme_color: '#1f2766',
        background_color: '#161c44',
        display: 'standalone',
        orientation: 'any',
        categories: ['education', 'productivity', 'business'],
        prefer_related_applications: false,
        start_url: '/',
        scope: '/',
        shortcuts: [
          { name: 'Tableau de bord', short_name: 'Accueil', url: '/' },
        ],
        icons: [
          { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // L'app shell est précaché (installable + ouverture hors-ligne) ;
        // les données de l'API ne sont JAMAIS mises en cache (fiches élèves, notes…).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,webmanifest}'],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    // Proxy de secours : le front appelle VITE_API_URL directement (CORS est
    // configuré côté API) ; le proxy évite tout souci si le port change.
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
