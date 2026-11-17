// Modale accessible : fermeture par Échap / clic sur le fond,
// focus initial, verrouillage du défilement de la page.
import { useEffect, useRef } from 'react';

export default function Modal({ titre, children, footer, onFermer, taille = '' }) {
  const boiteRef = useRef(null);
  // Toujours appeler la dernière version de onFermer sans relancer l'effet.
  const onFermerRef = useRef(onFermer);
  onFermerRef.current = onFermer;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onFermerRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const ancienOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus initial : uniquement à l'ouverture, jamais après une frappe.
    boiteRef.current?.querySelector('button, [href], input, select, textarea')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = ancienOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onFermer?.()}>
      <div
        ref={boiteRef}
        className={`modal ${taille === 'lg' ? 'modal-lg' : ''} ${taille === 'xl' ? 'modal-xl' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof titre === 'string' ? titre : undefined}
      >
        <div className="modal-header">
          <h3>{titre}</h3>
          <button type="button" className="modal-fermer" onClick={onFermer} aria-label="Fermer la fenêtre">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
