// =====================================================================
// Calcul des moyennes — SOURCE UNIQUE (section 2 du cahier).
//   moyenne_matière   = (moyenne(interro, devoir) + compo) / 2
//   moyenne_générale  = Σ(moyenne_matière × coefficient) / Σ coefficients
// Notes /20, les notes manquantes sont IGNORÉES (jamais comptées comme 0).
// Tous les arrondis à 2 décimales.
// =====================================================================

/** Moyenne des valeurs non nulles, ou null si aucune. */
function moyenne(valeurs) {
  const valides = valeurs.filter((v) => v !== null && v !== undefined && v !== '');
  if (valides.length === 0) return null;
  const total = valides.reduce((acc, v) => acc + Number(v), 0);
  return total / valides.length;
}

/** Arrondit à 2 décimales (sans flottant imprévisible). */
function arrondir(valeur) {
  if (valeur === null || valeur === undefined) return null;
  return Math.round((valeur + Number.EPSILON) * 100) / 100;
}

/** Normalise une note (chaîne/nombre → nombre ou null). */
function noteOuNull(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const n = Number(String(valeur).replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return n;
}

/**
 * Moyenne d'une matière sur la base d'un relevé (interro / devoir / compo).
 * @param {{interro?: number|string|null, devoir?: number|string|null, compo?: number|string|null}} releve
 * @returns {number|null}
 */
function moyenneMatiere(releve) {
  const interro = noteOuNull(releve?.interro);
  const devoir = noteOuNull(releve?.devoir);
  const compo = noteOuNull(releve?.compo);

  const epreuves = moyenne([interro, devoir]); // moyenne(interro, devoir)
  if (epreuves === null && compo === null) return null;
  if (epreuves === null) return arrondir(compo);
  if (compo === null) return arrondir(epreuves);
  return arrondir((epreuves + compo) / 2);
}

/**
 * Moyenne générale à partir des moyennes de matières pondérées par les coefficients.
 * @param {Array<{ moyenne: number|null, coefficient?: number|string }>} lignes
 * @returns {number|null}
 */
function moyenneGenerale(lignes) {
  let sommePonderee = 0;
  let sommeCoefficients = 0;
  for (const ligne of lignes) {
    if (ligne?.moyenne === null || ligne?.moyenne === undefined) continue;
    const coefficient = Number(ligne?.coefficient ?? 1);
    if (!(coefficient > 0)) continue;
    sommePonderee += Number(ligne.moyenne) * coefficient;
    sommeCoefficients += coefficient;
  }
  if (sommeCoefficients === 0) return null;
  return arrondir(sommePonderee / sommeCoefficients);
}

/** Appréciation automatique selon la moyenne (grille classique). */
function appreciation(moyenneValue) {
  if (moyenneValue === null || moyenneValue === undefined) return null;
  if (moyenneValue >= 16) return 'Très bien';
  if (moyenneValue >= 14) return 'Bien';
  if (moyenneValue >= 12) return 'Assez bien';
  if (moyenneValue >= 10) return 'Passable';
  if (moyenneValue >= 8) return 'Insuffisant';
  if (moyenneValue >= 6) return 'Faible';
  return 'Médiocre';
}

module.exports = { moyenneMatiere, moyenneGenerale, moyenne, arrondir, noteOuNull, appreciation };
