// Utilitaires de gestion des heures scolaires.
// 1 heure de cours = 55 minutes (configurable côté base : school_settings.duree_heure_minutes).
export const DUREE_HEURE_MINUTES = 55;

export function heureEnMinutes(heure) {
  const [h, m] = String(heure).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesEnHeure(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** heure_fin = heure_debut + nbHeures × 55 min (renvoyé en "HH:MM"). */
export function heureFinCalculee(heureDebut, nbHeures, dureeHeureMinutes = DUREE_HEURE_MINUTES) {
  return minutesEnHeure(heureEnMinutes(heureDebut) + nbHeures * dureeHeureMinutes);
}

/** Deux plages [debut,fin) se chevauchent-elles ? */
export function plagesSeChevauchent(debutA, finA, debutB, finB) {
  return heureEnMinutes(debutA) < heureEnMinutes(finB) && heureEnMinutes(debutB) < heureEnMinutes(finA);
}

/**
 * Détecte les conflits d'un ensemble de créneaux.
 * @param {Array} creneaux [{ id?, jour_semaine, heure_debut, heure_fin, aliasId?, professeurId?, salle? }]
 * @returns {Array<{a: object, b: object, raison: string}>}
 */
export function detecterChevauchements(creneaux) {
  const conflits = [];
  for (let i = 0; i < creneaux.length; i += 1) {
    for (let j = i + 1; j < creneaux.length; j += 1) {
      const a = creneaux[i];
      const b = creneaux[j];
      if (a.jour_semaine !== b.jour_semaine) continue;
      if (!plagesSeChevauchent(a.heure_debut, a.heure_fin, b.heure_debut, b.heure_fin)) continue;
      const raisons = [];
      if (a.aliasId && a.aliasId === b.aliasId) raisons.push('même alias de classe');
      if (a.professeurId && a.professeurId === b.professeurId) raisons.push('même professeur');
      if (a.salle && b.salle && String(a.salle).toLowerCase() === String(b.salle).toLowerCase()) raisons.push('même salle');
      if (raisons.length > 0) conflits.push({ a, b, raison: raisons.join(' + ') });
    }
  }
  return conflits;
}
