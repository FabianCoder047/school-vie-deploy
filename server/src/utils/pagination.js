// Helpers de pagination/recherche communs aux listes.
// Entrées brutes (query string) → valeurs sûres + fragment SQL.
function parsePagination(query, { parPageDefaut = 10, parPageMax = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  let parPage = Number.parseInt(query.parPage, 10) || parPageDefaut;
  parPage = Math.min(Math.max(1, parPage), parPageMax);
  const search = String(query.search || '').trim();
  return { page, parPage, offset: (page - 1) * parPage, search };
}

/** Bloc WHERE « nom LIKE ? » cumulable (ajoute les paramètres). */
function searchFragment(colonne, search, parametres) {
  if (!search) return '';
  parametres.push(`%${search}%`);
  return ` AND ${colonne} LIKE ? `;
}

module.exports = { parsePagination, searchFragment };
