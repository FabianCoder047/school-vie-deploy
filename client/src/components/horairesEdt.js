// Utilitaires d'affichage de l'emploi du temps (côté client).
// Les règles viennent de l'API (/edt-config) : 07:00, 55 min/heure,
// pause 09:45-10:10, fin 12:00, retour 14:30, primaire → 11:30.
export const DUREE_HEURE_DEFAUT = 55;
export const HAUTEUR_TRANCHE = 48;   // px pour une heure de cours (55 min)
export const HAUTEUR_PAUSE = 30;     // px pour la pause / le retour à la maison

export const REGLES_DEFAUT = {
  debutJournee: '07:00',
  dureeHeureMinutes: 55,
  pause: { debut: '09:45', fin: '10:10' },
  finMatin: '12:00',
  debutApresMidi: '14:30',
  finApresMidi: '17:30',
  finPrimaire: '11:30',
};

export function enMinutes(heure) {
  const [h, m] = String(heure).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function enHeure(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Segments verticaux : cours / pause / retour à la maison. */
export function segmentsDepuisRegles(regles = REGLES_DEFAUT, estPrimaire = false) {
  const segments = [
    { type: 'cours', debut: regles.debutJournee, fin: regles.pause.debut, libelle: 'Matin' },
    { type: 'pause', debut: regles.pause.debut, fin: regles.pause.fin, libelle: 'Pause' },
    {
      type: 'cours',
      debut: regles.pause.fin,
      fin: estPrimaire ? regles.finPrimaire : regles.finMatin,
      libelle: estPrimaire ? 'Reprise (primaire)' : 'Reprise',
    },
    { type: 'pause', debut: estPrimaire ? regles.finPrimaire : regles.finMatin, fin: regles.debutApresMidi, libelle: 'Retour à 14h30' },
    { type: 'cours', debut: regles.debutApresMidi, fin: regles.finApresMidi, libelle: estPrimaire ? 'Après-midi (primaire)' : 'Après-midi' },
  ];
  return segments;
}

function hauteurSegment(segment, dureeHeureMinutes) {
  if (segment.type === 'pause') return HAUTEUR_PAUSE;
  return ((enMinutes(segment.fin) - enMinutes(segment.debut)) / dureeHeureMinutes) * HAUTEUR_TRANCHE;
}

/** Position (top/height en px) d'un créneau dans la grille. */
export function positionEvenement(segments, debut, fin, dureeHeureMinutes = DUREE_HEURE_DEFAUT) {
  const y = (heure) => {
    let cumul = 0;
    const t = enMinutes(heure);
    for (const segment of segments) {
      const d = enMinutes(segment.debut);
      const f = enMinutes(segment.fin);
      if (t <= d) return cumul;
      if (t < f) {
        return cumul + (segment.type === 'pause'
          ? ((t - d) / (f - d)) * HAUTEUR_PAUSE
          : ((t - d) / dureeHeureMinutes) * HAUTEUR_TRANCHE);
      }
      cumul += hauteurSegment(segment, dureeHeureMinutes);
    }
    return cumul;
  };
  const top = y(debut);
  return { top, height: Math.max(y(fin) - top, 16) };
}

/** Hauteur totale de la grille. */
export function hauteurGrille(segments, dureeHeureMinutes = DUREE_HEURE_DEFAUT) {
  return segments.reduce((total, s) => total + hauteurSegment(s, dureeHeureMinutes), 0);
}

/** Heure approximative correspondant à une position verticale (pour le drag & drop). */
export function heureDepuisY(segments, y, dureeHeureMinutes = DUREE_HEURE_DEFAUT) {
  let cumul = 0;
  for (const segment of segments) {
    const hauteur = hauteurSegment(segment, dureeHeureMinutes);
    if (y < cumul + hauteur) {
      if (segment.type === 'pause') return segment.fin;
      const d = enMinutes(segment.debut);
      const f = enMinutes(segment.fin);
      const ratio = Math.max(0, Math.min(1, (y - cumul) / hauteur));
      return enHeure(Math.round((d + ratio * (f - d)) / 5) * 5);
    }
    cumul += hauteur;
  }
  return segments[segments.length - 1]?.fin || '07:00';
}

/** Heures de début autorisées pour un créneau classique (collège / lycée). */
export function debutsPossibles(regles = REGLES_DEFAUT) {
  const liste = [];
  const duree = regles.dureeHeureMinutes || DUREE_HEURE_DEFAUT;
  const fenetres = [
    [regles.debutJournee, regles.pause.debut],
    [regles.pause.fin, regles.finMatin],
    [regles.debutApresMidi, regles.finApresMidi],
  ];
  for (const [debut, fin] of fenetres) {
    for (let t = enMinutes(debut); t + duree <= enMinutes(fin); t += duree) liste.push(enHeure(t));
  }
  return liste;
}
