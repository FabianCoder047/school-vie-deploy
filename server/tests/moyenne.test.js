// Tests unitaires du service de moyennes — exécuter : npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  moyenneMatiere,
  moyenneGenerale,
  moyenne,
  noteOuNull,
  appreciation,
} = require('../src/services/moyenneService');

test('moyenneMatiere : interro + devoir + compo complets', () => {
  // (moyenne(12, 16) + 14) / 2 = (14 + 14) / 2 = 14
  assert.equal(moyenneMatiere({ interro: 12, devoir: 16, compo: 14 }), 14);
});

test('moyenneMatiere : interro et devoir manquants → compo seule', () => {
  assert.equal(moyenneMatiere({ interro: null, devoir: null, compo: 15 }), 15);
});

test('moyenneMatiere : compo manquante → moyenne épreuves seule', () => {
  // moyenne(10, 14) = 12
  assert.equal(moyenneMatiere({ interro: 10, devoir: 14, compo: null }), 12);
});

test('moyenneMatiere : interro manquant, devoir présent → moyenne des épreuves existantes', () => {
  // moyenne(null, 16) = 16 ; (16 + 10) / 2 = 13
  assert.equal(moyenneMatiere({ interro: null, devoir: 16, compo: 10 }), 13);
});

test('moyenneMatiere : toutes les notes manquantes → null', () => {
  assert.equal(moyenneMatiere({ interro: null, devoir: null, compo: null }), null);
  assert.equal(moyenneMatiere({}), null);
});

test('moyenneMatiere : virgule acceptée via notes brutes', () => {
  assert.equal(moyenneMatiere({ interro: '12,5', devoir: '15,5', compo: '14' }), 14);
});

test('moyenneGenerale : pondération par coefficients', () => {
  // (14 × 4 + 12 × 2) / 6 = 80 / 6 = 13.33
  const lignes = [
    { moyenne: 14, coefficient: 4 },
    { moyenne: 12, coefficient: 2 },
  ];
  assert.equal(moyenneGenerale(lignes), 13.33);
});

test('moyenneGenerale : les matières sans moyenne sont ignorées (jamais comptées comme 0)', () => {
  // Une seule matière renseignée, 10 × 4 / 4 = 10
  const lignes = [
    { moyenne: 10, coefficient: 4 },
    { moyenne: null, coefficient: 4 },
    { moyenne: null, coefficient: 2 },
  ];
  assert.equal(moyenneGenerale(lignes), 10);
});

test('moyenneGenerale : aucune matière renseignée → null', () => {
  assert.equal(moyenneGenerale([{ moyenne: null, coefficient: 4 }]), null);
  assert.equal(moyenneGenerale([]), null);
});

test('moyenneGenerale : coefficients différents respectés', () => {
  // (8×2 + 16×6) / 8 = (16 + 96) / 8 = 14
  const lignes = [
    { moyenne: 8, coefficient: 2 },
    { moyenne: 16, coefficient: 6 },
  ];
  assert.equal(moyenneGenerale(lignes), 14);
});

test('noteOuNull : espaces et virgules', () => {
  assert.equal(noteOuNull(' 12,5 '), 12.5);
  assert.equal(noteOuNull(''), null);
  assert.equal(noteOuNull(undefined), null);
  assert.equal(noteOuNull('abc'), null);
});

test('moyenne simple et appréciation', () => {
  assert.equal(moyenne([10, 20]), 15);
  assert.equal(moyenne([null, null]), null);
  assert.equal(appreciation(17), 'Très bien');
  assert.equal(appreciation(14), 'Bien');
  assert.equal(appreciation(15.9), 'Bien');
  assert.equal(appreciation(13), 'Assez bien');
  assert.equal(appreciation(12), 'Assez bien');
  assert.equal(appreciation(11.9), 'Passable');
  assert.equal(appreciation(10), 'Passable');
  assert.equal(appreciation(9), 'Insuffisant');
  assert.equal(appreciation(8), 'Insuffisant');
  assert.equal(appreciation(6), 'Faible');
  assert.equal(appreciation(5), 'Médiocre');
  assert.equal(appreciation(0), 'Médiocre');
  assert.equal(appreciation(null), null);
});
