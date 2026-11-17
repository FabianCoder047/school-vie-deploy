// Carte KPI (icône + libellé + valeur + détail optionnel).
export default function StatCard({ label, valeur, detail, tonalite = '', children }) {
  return (
    <div className="stat-card">
      <div className={`stat-card-icone ${tonalite}`}>{children}</div>
      <div>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-valeur">{valeur}</div>
        {detail && <div className="stat-card-detail">{detail}</div>}
      </div>
    </div>
  );
}
