// Onglets simples : tabs = [{ id, label }], ongletActif, onChange.
export default function Tabs({ tabs, ongletActif, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === ongletActif}
          className={`tab ${tab.id === ongletActif ? 'actif' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
