// Carte de contenu générique.
export default function Card({ titre, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(titre || actions) && (
        <div className="flex-between mb-4">
          {titre && <h2 className="card-titre" style={{ marginBottom: 0 }}>{titre}</h2>}
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
