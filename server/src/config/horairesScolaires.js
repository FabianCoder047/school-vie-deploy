// Horaires de l'emploi du temps — règles métier centralisées.
// Journée type : 07:00 → pause 09:45-10:10 → 12:00, retour 14:30 (17:30 fin).
// Primaire : mêmes ouvertures mais fin à 11:30 et durée des cours libre.
// Les heures sont lues dans school_settings (voir migration 008).
const pool = require('../config/db');
const settingsRepo = require('../repositories/settingsRepository');

const DEFAULTS = {
  debutJournee: '07:00',
  dureeHeureMinutes: 55,
  pauseDebut: '09:45',
  pauseFin: '10:10',
  finMatin: '12:00',
  debutApresMidi: '14:30',
  finApresMidi: '17:30',
  finPrimaire: '11:30',
};

function heure(value, defaut) {
  const s = String(value ?? '').trim();
  return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : defaut;
}

function enMinutes(h) {
  const [hh, mm] = String(h).slice(0, 5).split(':').map(Number);
  return hh * 60 + (mm || 0);
}

function enHeure(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Lit les horaires depuis la base, avec les valeurs par défaut en secours. */
async function regles() {
  let settings = null;
  try { settings = await settingsRepo.get(); } catch { /* base momentanément indisponible */ }
  return {
    debutJournee: heure(settings?.debut_journee, DEFAULTS.debutJournee),
    dureeHeureMinutes: Number(settings?.duree_heure_minutes) || DEFAULTS.dureeHeureMinutes,
    pause: {
      debut: heure(settings?.pause_matin_debut, DEFAULTS.pauseDebut),
      fin: heure(settings?.pause_matin_fin, DEFAULTS.pauseFin),
    },
    finMatin: heure(settings?.fin_matin, DEFAULTS.finMatin),
    debutApresMidi: heure(settings?.debut_apres_midi, DEFAULTS.debutApresMidi),
    finApresMidi: heure(settings?.fin_apres_midi, DEFAULTS.finApresMidi),
    finPrimaire: heure(settings?.fin_primaire, DEFAULTS.finPrimaire),
  };
}

function estPrimaire(nomCycle) {
  return String(nomCycle || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().includes('primaire');
}

/** Fenêtres continues dans lesquelles un créneau doit tenir entièrement. */
function plages(r, primaire) {
  return [
    { debut: r.debutJournee, fin: r.pause.debut, libelle: 'Matin' },
    {
      debut: r.pause.fin,
      fin: primaire ? r.finPrimaire : r.finMatin,
      libelle: primaire ? 'Reprise (primaire)' : 'Reprise',
    },
    { debut: r.debutApresMidi, fin: r.finApresMidi, libelle: 'Après-midi' },
  ];
}

/** Heures de début autorisées (multiple de la durée d'une heure de cours). */
function debutsPossibles(r, plage) {
  const liste = [];
  const fin = enMinutes(plage.fin);
  for (let d = enMinutes(plage.debut); d + r.dureeHeureMinutes <= fin; d += r.dureeHeureMinutes) {
    liste.push(enHeure(d));
  }
  return liste;
}

/** Heure de fin calculée pour un créneau "classique" (collège / lycée). */
function heureFinCalculee(debut, nbHeures, r) {
  return enHeure(enMinutes(debut) + Number(nbHeures) * r.dureeHeureMinutes);
}

/**
 * Vérifie qu'un créneau respecte les horaires.
 * @returns {{ valide: boolean, plage?: object, code?: string, message?: string }}
 */
function verifierCreneau({ debut, fin, primaire, r }) {
  if (!/^\d{2}:\d{2}$/.test(String(debut)) || !/^\d{2}:\d{2}$/.test(String(fin))) {
    return { valide: false, code: 'HEURE_INVALIDE', message: 'Heure invalide (format HH:MM attendu).' };
  }
  const d = enMinutes(debut);
  const f = enMinutes(fin);
  if (f <= d) return { valide: false, code: 'FIN_AVANT_DEBUT', message: 'L’heure de fin doit être postérieure à l’heure de début.' };

  const finMatinCycle = primaire ? r.finPrimaire : r.finMatin;
  const plage = plages(r, primaire).find((p) => d >= enMinutes(p.debut) && f <= enMinutes(p.fin));
  if (!plage) {
    if (d < enMinutes(r.debutJournee)) {
      return { valide: false, code: 'AVANT_DEBUT_JOURNEE', message: `Les cours commencent à ${r.debutJournee}.` };
    }
    if (d < enMinutes(r.pause.debut) && f > enMinutes(r.pause.debut)) {
      return { valide: false, code: 'TRAVERSE_PAUSE', message: `Le créneau ne peut pas traverser la pause de ${r.pause.debut} à ${r.pause.fin}.` };
    }
    if (d >= enMinutes(r.pause.debut) && d < enMinutes(r.pause.fin)) {
      return { valide: false, code: 'DANS_PAUSE', message: `La pause va de ${r.pause.debut} à ${r.pause.fin} : aucun cours n’est autorisé.` };
    }
    if (d >= enMinutes(finMatinCycle) && d < enMinutes(r.debutApresMidi)) {
      return { valide: false, code: 'PAUSE_REPAS', message: `Les élèves rentrent à ${finMatinCycle} : le prochain cours commence à ${r.debutApresMidi}.` };
    }
    if (d < enMinutes(r.debutApresMidi) && f > enMinutes(finMatinCycle)) {
      return {
        valide: false,
        code: primaire ? 'APRES_FIN_PRIMAIRE' : 'APRES_FIN_MATIN',
        message: primaire
          ? `Au primaire, les cours du matin se terminent à ${r.finPrimaire}.`
          : `La matinée se termine à ${r.finMatin}.`,
      };
    }
    if (d >= enMinutes(r.debutApresMidi) && f > enMinutes(r.finApresMidi)) {
      return { valide: false, code: 'APRES_FIN_JOURNEE', message: `Les cours de l’après-midi se terminent à ${r.finApresMidi}.` };
    }
    return { valide: false, code: 'HORS_HORAIRE', message: 'Ce créneau sort des horaires de cours autorisés.' };
  }

  if (!primaire && !debutsPossibles(r, plage).includes(debut)) {
    return {
      valide: false,
      code: 'DEBUT_NON_ALIGNE',
      message: `Le début doit être ${debutsPossibles(r, plage).join(', ')} (heures de ${r.dureeHeureMinutes} min).`,
    };
  }
  return { valide: true, plage };
}

/** Configuration complète exposée au front (EDT directeur/secrétaire). */
async function configuration() {
  const r = await regles();
  const [cycles] = await pool.query('SELECT id, nom FROM cycles ORDER BY ordre, nom');
  const cyclesPrimaire = cycles.filter((c) => estPrimaire(c.nom)).map((c) => c.id);
  const tranches = plages(r, false).flatMap((p) => debutsPossibles(r, p).map((debut) => ({
    debut,
    fin: heureFinCalculee(debut, 1, r),
    plage: p.libelle,
  })));
  return { regles: r, cyclesPrimaire, tranches };
}

module.exports = {
  DEFAULTS, regles, estPrimaire, plages, debutsPossibles, heureFinCalculee,
  verifierCreneau, configuration, enMinutes, enHeure,
};
