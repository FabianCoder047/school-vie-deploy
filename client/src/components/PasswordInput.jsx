// Champ mot de passe avec « voyant » (bouton œil pour afficher/masquer).
import { forwardRef, useState } from 'react';

const PasswordInput = forwardRef(function PasswordInput(
  { label, erreur, aide, requis, id, className = '', ...props },
  ref
) {
  const [visible, setVisible] = useState(false);
  const champId = id || props.name;
  return (
    <div className={`champ ${className}`}>
      {label && (
        <label htmlFor={champId}>
          {label}
          {requis && <span className="champ-requis" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="champ-mdp">
        <input
          id={champId}
          ref={ref}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(erreur)}
          {...props}
        />
        <button
          type="button"
          className="champ-mdp-voyant"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
        >
          {visible ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-5.5 0-9.5-4.5-10.7-7 .42-.9 1.26-2.2 2.63-3.55M9.9 4.24A10.4 10.4 0 0 1 12 4.5c5.5 0 9.5 4.5 10.7 7-.34.75-.87 1.6-1.62 2.47"/><path d="m2 2 20 20"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>
      </div>
      {erreur && <span className="champ-erreur">{erreur}</span>}
      {aide && !erreur && <span className="champ-aide">{aide}</span>}
    </div>
  );
});

export default PasswordInput;
