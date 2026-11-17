// Zone de texte standardisée.
export default function Textarea({ label, erreur, aide, requis, id, rows = 4, className = '', ...props }) {
  const champId = id || props.name;
  return (
    <div className={`champ ${className}`}>
      {label && (
        <label htmlFor={champId}>
          {label}
          {requis && <span className="champ-requis" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea id={champId} rows={rows} aria-invalid={Boolean(erreur)} {...props} />
      {erreur && <span className="champ-erreur">{erreur}</span>}
      {aide && !erreur && <span className="champ-aide">{aide}</span>}
    </div>
  );
}
