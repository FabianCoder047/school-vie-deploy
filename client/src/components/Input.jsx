// Champ de saisie standardisé (label + erreur + aide).
import { forwardRef } from 'react';

const Input = forwardRef(function Input(
  { label, erreur, aide, requis, id, className = '', ...props },
  ref
) {
  const champId = id || props.name;
  return (
    <div className={`champ ${className}`}>
      {label && (
        <label htmlFor={champId}>
          {label}
          {requis && <span className="champ-requis" aria-hidden="true">*</span>}
        </label>
      )}
      <input id={champId} ref={ref} aria-invalid={Boolean(erreur)} {...props} />
      {erreur && <span className="champ-erreur">{erreur}</span>}
      {aide && !erreur && <span className="champ-aide">{aide}</span>}
    </div>
  );
});

export default Input;
