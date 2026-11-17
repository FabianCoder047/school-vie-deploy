// ConfirmContext : confirm() / supprimer() retournent une Promise<bool>.
// Usage : const ok = await confirmer({ titre, message, type: 'danger' });
import { useCallback, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { ConfirmContext } from './ConfirmContextValue';

export function ConfirmProvider({ children }) {
  const [demande, setDemande] = useState(null);
  const resoudreRef = useRef(null);

  const demander = useCallback((options) => {
    return new Promise((resolve) => {
      resoudreRef.current = resolve;
      setDemande({
        titre: 'Confirmation',
        texteConfirmer: 'Confirmer',
        texteAnnuler: 'Annuler',
        type: 'avertissement',
        ...options,
      });
    });
  }, []);

  const fermer = useCallback((resultat) => {
    resoudreRef.current?.(resultat);
    resoudreRef.current = null;
    setDemande(null);
  }, []);

  const api = useMemo(() => ({
    confirmer: demander,
    supprimer: (message, titre = 'Supprimer') =>
      demander({ titre, message, type: 'danger', texteConfirmer: 'Supprimer' }),
  }), [demander]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {demande && (
        <ConfirmDialog
          titre={demande.titre}
          message={demande.message}
          type={demande.type}
          texteConfirmer={demande.texteConfirmer}
          texteAnnuler={demande.texteAnnuler}
          onConfirmer={() => fermer(true)}
          onAnnuler={() => fermer(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}
