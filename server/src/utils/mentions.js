// Mentions « Travail de l'élève » du bulletin (proposition automatique,
// à titre indicatif — la décision finale appartient au conseil de classe).
// Règle (exclusive, de la meilleure à la pire) :
//   Tableau d'Honneur   si moyenne >= 14 et < 16
//   T.H + Félicitation  si moyenne >= 16
//   T.H + Encouragement si moyenne >= 12 et < 14
//   Avertissement Travail si moyenne >= 6 et < 8
//   Blâme Travail        si moyenne < 6
// (entre 8 et 12 : rien ; la décision revient au conseil de classe)

function mentionsTravail(moyenne) {
  const m = moyenne === null || moyenne === undefined ? null : Number(moyenne);
  const vide = {
    tableauHonneur: false,
    thomEncouragement: false,
    thomFelicitation: false,
    avertissementTravail: false,
    blameTravail: false,
  };
  if (m === null || !Number.isFinite(m)) return vide;
  return {
    tableauHonneur: m >= 14 && m < 16,
    thomEncouragement: m >= 12 && m < 14,
    thomFelicitation: m >= 16,
    avertissementTravail: m >= 6 && m < 8,
    blameTravail: m < 6,
  };
}

module.exports = { mentionsTravail };
