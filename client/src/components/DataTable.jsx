// Tableau « soft » : scroll vertical ET horizontal, en-tête collant,
// état vide intégré. columns : [{ cle, titre, rendu?(ligne), largeur? }]
export default function DataTable({ columns, data, cleLigne = 'id', messageVide = 'Aucune donnée.', enChargement = false }) {
  return (
    <div className="table-conteneur">
      <table className="tableau">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.cle} style={col.largeur ? { width: col.largeur } : undefined}>
                {col.titre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {enChargement ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="etat-vide"><div className="spinner" style={{ margin: '0 auto' }} /></div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="etat-vide">{messageVide}</div>
              </td>
            </tr>
          ) : (
            data.map((ligne) => (
              <tr key={ligne[cleLigne]}>
                {columns.map((col) => (
                  <td key={col.cle}>{col.rendu ? col.rendu(ligne) : ligne[col.cle]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
