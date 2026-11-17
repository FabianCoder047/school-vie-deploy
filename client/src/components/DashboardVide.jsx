// Squelette commun des tableaux de bord (Sprint 0) : KPI à 0/— et
// encart explicatif. Chaque tableau sera branché sur l'API dans son
// sprint dédié (voir la mention sous chaque indicateur).
export default function DashboardVide({ titre, indicateurs, sprint }) {
  return (
    <>
      <h1 className="page-titre">{titre}</h1>
      <div className="grid-4 mb-4">
        {indicateurs.map((kpi) => (
          <div className="stat-card" key={kpi.label}>
            <div className={`stat-card-icone ${kpi.tonalite || ''}`}>{kpi.icone}</div>
            <div>
              <div className="stat-card-label">{kpi.label}</div>
              <div className="stat-card-valeur">{kpi.valeur ?? '—'}</div>
              <div className="stat-card-detail">{kpi.detail || `Données au ${sprint}`}</div>
            </div>
          </div>
        ))}
      </div>
      <section className="card">
        <h2 className="card-titre">Espace en cours de construction</h2>
        <p style={{ color: 'var(--gris-600)', maxWidth: 720 }}>
          Ce tableau de bord et les modules du menu latéral seront activés sprint après sprint.
          Les indicateurs ci-dessus sont des emplacements : ils afficheront les données réelles dès
          que les API correspondantes seront livrées ({sprint}).
        </p>
      </section>
    </>
  );
}
