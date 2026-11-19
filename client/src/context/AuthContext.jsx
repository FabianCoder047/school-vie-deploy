import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { setTokens, getRefreshToken, clearTokens } from '../api/tokenStore';
import { AuthContext } from './AuthContextValue';
import { ROLE_DASHBOARD } from '../routes/roleRoutes';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [chargement, setChargement] = useState(true);

  // Au démarrage : si un refresh token existe, on le tente pour restaurer
  // la session sans repasser par le formulaire de connexion.
  useEffect(() => {
    let actif = true;
    (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        if (actif) setChargement(false);
        return;
      }
      try {
        const { data } = await api.post('/auth/refresh', { refreshToken });
        if (!actif) return;
        setTokens({ access: data.accessToken, refresh: data.refreshToken });
        setUser(data.user);
      } catch (err) {
        // Pendant une maintenance, l'API répond 503 MAINTENANCE : on garde
        // les tokens (la session reprendra dès la fin) au lieu de déconnecter.
        const estMaintenance = err?.response?.status === 503 && err?.response?.data?.code === 'MAINTENANCE';
        if (!estMaintenance) clearTokens();
      } finally {
        if (actif) setChargement(false);
      }
    })();
    return () => { actif = false; };
  }, []);

  const connexion = useCallback(async (identifier, password) => {
    const { data } = await api.post('/auth/login', { identifier, password });
    setTokens({ access: data.accessToken, refresh: data.refreshToken });
    setUser(data.user);
    return data.user;
  }, []);

  const deconnexion = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch (_err) {
      // La déconnexion locale doit réussir même si l'API est indisponible.
    }
    clearTokens();
    setUser(null);
  }, []);

  const changerMotDePasse = useCallback(async (currentPassword, newPassword) => {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
    setTokens({ access: data.accessToken, refresh: data.refreshToken });
    setUser(data.user);
    return data.user;
  }, []);

  const tableauDeBord = user ? ROLE_DASHBOARD[user.role] : '/connexion';

  return (
    <AuthContext.Provider
      value={{ user, chargement, connexion, deconnexion, changerMotDePasse, tableauDeBord }}
    >
      {children}
    </AuthContext.Provider>
  );
}
