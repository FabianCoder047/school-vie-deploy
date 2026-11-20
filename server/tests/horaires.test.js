// Règles horaires de l'emploi du temps (migration 008) — tests unitaires.
const test = require('node:test');
const assert = require('node:assert/strict');
const horaires = require('../src/config/horairesScolaires');

const REGLES = {
  debutJournee: '07:00',
  dureeHeureMinutes: 55,
  pause: { debut: '09:45', fin: '10:10' },
  finMatin: '12:00',
  debutApresMidi: '14:30',
  finApresMidi: '17:30',
  finPrimaire: '11:30',
};

test('trois heures de 55 min remplissent exactement 07:00 → 09:45', () => {
  assert.equal(horaires.heureFinCalculee('07:00', 3, REGLES), '09:45');
  assert.equal(horaires.heureFinCalculee('10:10', 2, REGLES), '12:00');
});

test('les créneaux du collège/lycée doivent tenir dans une seule fenêtre', () => {
  const cas = [
    ['07:00', '09:45', true],
    ['08:50', '10:40', false], // traverse la pause
    ['09:45', '10:10', false], // dans la pause
    ['10:10', '12:00', true],
    ['12:00', '14:30', false], // retour à la maison
    ['14:30', '17:15', true],
    ['14:30', '18:00', false], // après la fin configurable
  ];
  for (const [debut, fin, attendu] of cas) {
    const resultat = horaires.verifierCreneau({ debut, fin, primaire: false, r: REGLES });
    assert.equal(resultat.valide, attendu, `${debut} → ${fin}`);
  }
});

test('le début doit respecter la grille de 55 min (collège/lycée)', () => {
  const resultat = horaires.verifierCreneau({ debut: '07:30', fin: '08:25', primaire: false, r: REGLES });
  assert.equal(resultat.valide, false);
  assert.equal(resultat.code, 'DEBUT_NON_ALIGNE');
});

test('le primaire a une durée libre, le matin jusqu’à 11:30 et l’après-midi dès 14:30', () => {
  assert.equal(horaires.verifierCreneau({ debut: '10:10', fin: '11:30', primaire: true, r: REGLES }).valide, true);
  const tropLong = horaires.verifierCreneau({ debut: '10:10', fin: '11:35', primaire: true, r: REGLES });
  assert.equal(tropLong.valide, false);
  assert.equal(tropLong.code, 'APRES_FIN_PRIMAIRE');
  assert.equal(horaires.verifierCreneau({ debut: '11:30', fin: '14:30', primaire: true, r: REGLES }).code, 'PAUSE_REPAS');
  assert.equal(horaires.verifierCreneau({ debut: '14:30', fin: '16:10', primaire: true, r: REGLES }).valide, true);
  assert.equal(horaires.verifierCreneau({ debut: '14:30', fin: '18:00', primaire: true, r: REGLES }).code, 'APRES_FIN_JOURNEE');
});

test('détection du cycle primaire', () => {
  assert.equal(horaires.estPrimaire('Primaire'), true);
  assert.equal(horaires.estPrimaire('École primaire'), true);
  assert.equal(horaires.estPrimaire('Collège'), false);
});
