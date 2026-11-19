// Appréciation automatique selon la moyenne (même échelle que le serveur).
// Non modifiable : calculée depuis la moyenne, affichée en lecture seule.
export function appreciation(moyenne) {
  if (moyenne === null || moyenne === undefined) return null;
  if (moyenne >= 16) return 'Très bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez bien';
  if (moyenne >= 10) return 'Passable';
  if (moyenne >= 8) return 'Insuffisant';
  if (moyenne >= 6) return 'Faible';
  return 'Médiocre';
}
