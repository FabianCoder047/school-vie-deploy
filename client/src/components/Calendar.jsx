// Calendrier vue semaine (lun. → sam.) — grille conforme aux horaires de l'école :
// cours de 55 min, pause 09:45–10:10, retour à 14h30, fin 11:30 au primaire.
// evenements : [{ id, jour (1=lundi..5=vendredi), heureDebut "HH:MM",
//                 heureFin "HH:MM", titre, sousTitre?, chevauchement? }]
import {
  REGLES_DEFAUT, segmentsDepuisRegles, positionEvenement, hauteurGrille,
  enMinutes, enHeure, HAUTEUR_TRANCHE, HAUTEUR_PAUSE,
} from './horairesEdt';

const JOURS = [
  { numero: 1, label: 'Lundi' },
  { numero: 2, label: 'Mardi' },
  { numero: 3, label: 'Mercredi' },
  { numero: 4, label: 'Jeudi' },
  { numero: 5, label: 'Vendredi' },
];

export default function Calendar({
  evenements = [], onEvenementClick, lectureSeule = false, config = null, estPrimaire = false,
  onDragStart, onDropSurJour,
}) {
  const regles = config?.regles || REGLES_DEFAUT;
  const duree = regles.dureeHeureMinutes || 55;
  const segments = segmentsDepuisRegles(regles, estPrimaire);
  const hauteurTotale = hauteurGrille(segments, duree);

  // Découpe les fenêtres de cours en lignes de 55 min pour la gouttière et le fond.
  const lignes = segments.flatMap((segment) => {
    if (segment.type === 'pause') return [{ ...segment, hauteur: HAUTEUR_PAUSE, pause: true }];
    const debut = enMinutes(segment.debut);
    const fin = enMinutes(segment.fin);
    const resultat = [];
    for (let t = debut; t < fin; t += duree) {
      const finLigne = Math.min(t + duree, fin);
      resultat.push({
        debut: enHeure(t), fin: enHeure(finLigne), libelle: enHeure(t),
        hauteur: ((finLigne - t) / duree) * HAUTEUR_TRANCHE, pause: false,
      });
    }
    return resultat;
  });

  return (
    <div className="calendrier" role="grid" aria-label="Emploi du temps — vue semaine">
      <div className="calendrier-grille">
        {/* Gouttière horaire */}
        <div className="calendrier-gouttiere">
          <div className="calendrier-gouttiere-entete" style={{ height: 41 }} aria-hidden="true" />
          {lignes.map((ligne, index) => (
            <div
              key={`${ligne.debut}-${index}`}
              className={ligne.pause ? 'calendrier-pause-heure' : 'calendrier-gouttiere-heure'}
              style={{ height: ligne.hauteur }}
              title={ligne.pause ? ligne.libelle : undefined}
            >
              {ligne.pause ? ligne.libelle : ligne.debut}
            </div>
          ))}
        </div>
        {/* Colonnes des jours */}
        {JOURS.map((jour) => (
          <div key={jour.numero} className="calendrier-jour" role="gridcell" aria-label={jour.label}>
            <div className="calendrier-jour-entete">{jour.label}</div>
            <div
              style={{ position: 'relative', height: hauteurTotale }}
              onDragOver={onDropSurJour ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } : undefined}
              onDrop={onDropSurJour ? (e) => {
                e.preventDefault();
                onDropSurJour(e, jour.numero, e.clientY - e.currentTarget.getBoundingClientRect().top);
              } : undefined}
            >
              {lignes.map((ligne, index) => (
                <div
                  key={`${ligne.debut}-${index}`}
                  className={ligne.pause ? 'calendrier-jour-pause' : 'calendrier-jour-fond'}
                  style={{ height: ligne.hauteur }}
                  title={ligne.pause ? ligne.libelle : undefined}
                />
              ))}
              {evenements
                .filter((ev) => ev.jour === jour.numero)
                .map((ev) => {
                  const { top, height } = positionEvenement(segments, ev.heureDebut, ev.heureFin, duree);
                  return (
                    <button
                      key={ev.id ?? `${ev.heureDebut}-${ev.titre}`}
                      type="button"
                      draggable={Boolean(onDragStart)}
                      onDragStart={onDragStart ? (e) => onDragStart(e, ev) : undefined}
                      className={`evenement ${ev.chevauchement ? 'chevauchement' : ''}`}
                      style={{ top, height, cursor: onDragStart ? 'grab' : undefined }}
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
