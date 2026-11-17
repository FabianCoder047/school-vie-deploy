// Utilitaires de temps partagés (55 minutes = 1 heure de cours).
const DUREE_HEURE_MINUTES = 55;

function heureEnMinutes(heure) {
  const [h, m] = String(heure).slice(0, 5).split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesEnHeure(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** heure_fin = heure_debut + nbHeures × 55 min. */
function heureFinCalculee(heureDebut, nbHeures, duree = DUREE_HEURE_MINUTES) {
  return minutesEnHeure(heureEnMinutes(heureDebut) + nbHeures * duree);
}

/** Deux plages [debut,fin) se chevauchent-elles ? */
function plagesSeChevauchent(debutA, finA, debutB, finB) {
  return heureEnMinutes(debutA) < heureEnMinutes(finB) && heureEnMinutes(debutB) < heureEnMinutes(finA);
}

module.exports = { DUREE_HEURE_MINUTES, heureEnMinutes, minutesEnHeure, heureFinCalculee, plagesSeChevauchent };
