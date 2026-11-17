// Pagination « < 1, 2, 3 ... 10 > » + sélecteur de lignes (10/25/50/100).
const PAR_PAGE_OPTIONS = [10, 25, 50, 100];

function fenetrePages(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = [1];
  const debut = Math.max(2, page - 2);
  const fin = Math.min(totalPages - 1, page + 2);
  if (debut > 2) pages.push('…');
  for (let p = debut; p <= fin; p += 1) pages.push(p);
  if (fin < totalPages - 1) pages.push('…');
  pages.push(totalPages);
  return pages;
}

export default function Pagination({ page, totalPages, total, parPage, onChangePage, onChangeParPage }) {
  if (!totalPages || totalPages < 1) totalPages = 1;
  const pages = fenetrePages(page, totalPages);

  return (
    <div className="pagination">
      <div className="pagination-lignes">
        <span>{total ?? 0} élément{(total ?? 0) > 1 ? 's' : ''}</span>
        <label htmlFor="lignes-par-page" style={{ marginLeft: 12 }}>Lignes par page</label>
        <select
          id="lignes-par-page"
          value={parPage}
          onChange={(e) => onChangeParPage(Number(e.target.value))}
        >
          {PAR_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="pagination-numeros">
        <button type="button" className="pagination-btn" disabled={page <= 1} onClick={() => onChangePage(page - 1)} aria-label="Page précédente">‹</button>
        {pages.map((p, index) =>
          p === '…' ? (
            <span key={`ellipse-${index}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`pagination-btn ${p === page ? 'actif' : ''}`}
              onClick={() => onChangePage(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
        <button type="button" className="pagination-btn" disabled={page >= totalPages} onClick={() => onChangePage(page + 1)} aria-label="Page suivante">›</button>
      </div>
    </div>
  );
}
