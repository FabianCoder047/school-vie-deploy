// Calendrier vue semaine (lun. → sam.), créneaux calés sur la grille
// de 55 minutes. La création/déplacement des créneaux arrive au Sprint 3 —
// ce composant gère déjà le rendu, la hauteur proportionnelle à la durée
// et le surlignage des chevauchements.
//
// evenements : [{ id, jour (1=lundi..6=samedi), heureDebut "HH:MM",
//                 heureFin "HH:MM", titre, sousTitre?, chevauchement? }]
import { heureEnMinutes, minutesEnHeure } from './CalendarUtils';

const HEURE_DEBUT = 7 * 60;   // 07:00
const HEURE_FIN = 19 * 60;    // 19:00
const PAS = 55;               // découpage en tranches de 55 minutes
const HAUTEUR_TRANCHE = 48;   // px

const JOURS = [
  { numero: 1, label: 'Lundi' },
  { numero: 2, label: 'Mardi' },
  { numero: 3, label: 'Mercredi' },
  { numero: 4, label: 'Jeudi' },
  { numero: 5, label: 'Vendredi' },
  { numero: 6, label: 'Samedi' },
];

const TRANCHES = [];
for (let t = HEURE_DEBUT; t < HEURE_FIN; t += PAS) TRANCHES.push(t);

export default function Calendar({ evenements = [], onEvenementClick, lectureSeule = false }) {
  const hauteurTotale = TRANCHES.length * HAUTEUR_TRANCHE;

  const positionEvenement = (ev) => {
    const debut = heureEnMinutes(ev.heureDebut);
    const fin = heureEnMinutes(ev.heureFin);
    const top = ((debut - HEURE_DEBUT) / PAS) * HAUTEUR_TRANCHE;
    const hauteur = Math.max(((fin - debut) / PAS) * HAUTEUR_TRANCHE, 20);
    return { top, height: hauteur };
  };

  return (
    <div className="calendrier" role="grid" aria-label="Emploi du temps — vue semaine">
      <div className="calendrier-grille">
        {/* Gouttière horaire */}
        <div className="calendrier-gouttiere">
          <div className="calendrier-gouttiere-entete" style={{ height: 41 }} aria-hidden="true" />
          {TRANCHES.map((t) => (
            <div key={t} className="calendrier-gouttiere-heure">{minutesEnHeure(t)}</div>
          ))}
        </div>
        {/* Colonnes des jours */}
        {JOURS.map((jour) => (
          <div key={jour.numero} className="calendrier-jour" role="gridcell" aria-label={jour.label}>
            <div className="calendrier-jour-entete">{jour.label}</div>
            <div style={{ position: 'relative', height: hauteurTotale }}>
              {TRANCHES.map((t) => <div key={t} className="calendrier-jour-fond" />)}
              {evenements
                .filter((ev) => ev.jour === jour.numero)
                .map((ev) => {
                  const { top, height } = positionEvenement(ev);
                  return (
                    <button
                      key={ev.id ?? `${ev.heureDebut}-${ev.titre}`}
                      type="button"
                      className={`evenement ${ev.chevauchement ? 'chevauchement' : ''}`}
                      style={{ top, height }}
                      onClick={() => onEvenementClick?.(ev)}
                      title={lectureSeule ? `${ev.titre} (lecture seule)` : `${ev.titre} — ${ev.heureDebut}–${ev.heureFin}`}
                    >
                      <div>{ev.titre}</div>
                      {ev.sousTitre && <div className="evenement-sous">{ev.sousTitre}</div>}
                      <div className="evenement-sous">{ev.heureDebut} – {ev.heureFin}</div>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
