// Stockage des tokens : l'access token vit UNIQUEMENT en mémoire
// (jamais dans localStorage), le refresh token est en localStorage —
// le risque XSS est documenté dans le README ; la rotation côté serveur
// révoque chaque refresh token après usage.
const REFRESH_KEY = 'school_vie_refresh_token';

let accessToken = null;

export function setTokens({ access, refresh }) {
  if (access !== undefined) accessToken = access;
  if (refresh !== undefined && refresh !== null) {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}
