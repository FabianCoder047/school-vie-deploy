// Toasts globaux (aucun alert()/confirm() natif).
import { useCallback, useMemo, useState } from 'react';
import { ToastContext } from './ToastContextValue';

let compteur = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const retirer = useCallback((id) => {
    setToasts((liste) => liste.filter((t) => t.id !== id));
  }, []);

  const afficher = useCallback((message, type = 'info', duree = 4500) => {
    compteur += 1;
    const id = compteur;
    setToasts((liste) => [...liste, { id, message, type }]);
    window.setTimeout(() => retirer(id), duree);
  }, [retirer]);

  const api = useMemo(() => ({
    succes: (msg) => afficher(msg, 'succes'),
    erreur: (msg) => afficher(msg, 'erreur', 6000),
    info: (msg) => afficher(msg, 'info'),
    avertissement: (msg) => afficher(msg, 'avertissement', 5500),
  }), [afficher]);

  const ICONES = {
    succes: '✓',
    erreur: '✕',
    info: 'ℹ',
    avertissement: '⚠',
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-zone" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} onClick={() => retirer(toast.id)}>
            <span aria-hidden="true">{ICONES[toast.type]}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
