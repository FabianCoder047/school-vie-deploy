// État de la fenêtre de maintenance (endpoint PUBLIC /maintenance/status).
// Fournit : active/planifiée, dates, message, nom/logo de l'établissement.
// Sondage toutes les 60 s + écoute de l'évènement « school-vie:maintenance »
// déclenché par l'intercepteur Axios dès qu'une API répond 503 MAINTENANCE.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const MaintenanceContext = createContext(null);

const ETAT_INITIAL = {
  active: false,
  planifiee: false,
  etat: 'aucune',
  debut: null,
  fin: null,
  message: '',
  etablissement: null,
  chargement: true,
};

export function MaintenanceProvider({ children }) {
  const [etat, setEtat] = useState(ETAT_INITIAL);

  const verifier = useCallback(async () => {
    try {
      const { data } = await api.get('/maintenance/status');
      setEtat({ ...data, chargement: false });
    } catch (_err) {
      // API momentanément injoignable : on ne force pas la page de maintenance,
      // les erreurs réseau seront gérées comme d'habitude par l'application.
      setEtat((precedent) => ({ ...precedent, chargement: false }));
    }
  }, []);

  useEffect(() => {
    verifier();
    const intervalle = window.setInterval(verifier, 60_000);
    const surEvenement = () => verifier();
    window.addEventListener('school-vie:maintenance', surEvenement);
    return () => {
      window.clearInterval(intervalle);
      window.removeEventListener('school-vie:maintenance', surEvenement);
    };
  }, [verifier]);

  return (
    <MaintenanceContext.Provider value={{ ...etat, verifier }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error('useMaintenance doit être utilisé dans <MaintenanceProvider>.');
  return ctx;
}
