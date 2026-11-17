// Barre de recherche réutilisable (icône intégrée).
import { useEffect, useState } from 'react';

export default function SearchBar({ valeur, onChange, placeholder = 'Rechercher…', debounceMs = 300 }) {
  const [local, setLocal] = useState(valeur ?? '');

  useEffect(() => { setLocal(valeur ?? ''); }, [valeur]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (local !== valeur) onChange?.(local);
    }, debounceMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className="search-bar" role="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {local && (
        <button type="button" onClick={() => setLocal('')} aria-label="Effacer la recherche" className="btn-ghost btn btn-icon btn-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      )}
    </div>
  );
}
