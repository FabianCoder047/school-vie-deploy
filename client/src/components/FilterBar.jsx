// Conteneur de filtres (recherche + selects avec libellés) en carte grise.
export default function FilterBar({ children, className = '' }) {
  return <div className={`filter-bar ${className}`}>{children}</div>;
}
