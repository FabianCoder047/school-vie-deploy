// Liste déroulante standardisée.
export default function Select({ label, erreur, aide, requis, id, children, className = '', ...props }) {
  const champId = id || props.name;
  return (
    <div className={`champ ${className}`}>
      {label && (
        <label htmlFor={champId}>
          {label}
          {requis && <span className="champ-requis" aria-hidden="true">*</span>}
        </label>
      )}
      <select id={champId} aria-invalid={Boolean(erreur)} {...props}>
        {children}
      </select>
      {erreur && <span className="champ-erreur">{erreur}</span>}
      {aide && !erreur && <span className="champ-aide">{aide}</span>}
    </div>
  );
}
