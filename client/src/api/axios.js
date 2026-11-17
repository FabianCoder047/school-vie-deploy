// Client HTTP unique (Axios) avec :
//  - injection automatique du Bearer access token
//  - rafraîchissement transparent sur 401 (une seule requête de refresh
//    en vol, les autres requêtes attendent et sont rejouées)
//  - déconnexion propre si le refresh échoue
import axios from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshEnCours = null;

async function rafraichir() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('Aucune session.');
  const { data } = await axios.post(
    `${api.defaults.baseURL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  setTokens({ access: data.accessToken, refresh: data.refreshToken });
  return data.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const estAuth = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');

    if (status === 401 && !original._retry && !estAuth) {
      original._retry = true;
      try {
        refreshEnCours = refreshEnCours || rafraichir().finally(() => { refreshEnCours = null; });
        const nouveauToken = await refreshEnCours;
        original.headers.Authorization = `Bearer ${nouveauToken}`;
        return api(original);
      } catch (_refreshError) {
        clearTokens();
        if (window.location.pathname !== '/connexion') {
          window.location.assign('/connexion');
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

/** Message d'erreur français prêt à afficher. */
export function messageErreur(error, defaut = 'Une erreur est survenue.') {
  return error?.response?.data?.message || defaut;
}

/**
 * Télécharge un PDF authentifié (les endpoints exigent le Bearer token,
 * un simple <a href> ne suffit donc pas) : récupère le blob puis ouvre
 * un onglet avec l'object URL.
 */
export async function ouvrirPdf(url, nomFichier = 'document.pdf') {
  const response = await api.get(url, { responseType: 'blob' });
  // Nom de fichier propre si le serveur expose Content-Disposition
  const dispo = response.headers?.['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/i.exec(dispo);
  const nom = match?.[1] || nomFichier;
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const onglet = window.open(objectUrl, '_blank', 'noopener');
  if (!onglet) {
    // Fenêtre bloquée par le navigateur → téléchargement classique
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = nom;
    a.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export default api;
