// URL absolue d'un fichier servi par l'API (/uploads/…).
// L'origine est déduite de VITE_API_URL (utile quand le front et l'API sont
// sur deux domaines différents en production).
export function urlUpload(chemin) {
  if (!chemin) return null;
  if (String(chemin).startsWith('http')) return chemin;
  const origine = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  return `${origine}${chemin}`;
}
