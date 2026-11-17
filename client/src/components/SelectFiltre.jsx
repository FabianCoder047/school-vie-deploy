// Select de filtre avec libellé visible, aligné sur la SearchBar.
// "children" = les <option>.
export default function SelectFiltre({ label, className = '', children, ...props }) {
  return (
    <label className={`filtre-champ ${className}`}>
      {label && <span className="filtre-label">{label}</span>}
      <select className="select-filtre" {...props}>
        {children}
      </select>
    </label>
  );
}
