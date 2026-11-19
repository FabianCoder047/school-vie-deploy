// Tests unitaires — formatRang (« 1er », « 2ème »…) et mentionsTravail.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { formatRang } = require('../src/utils/rang');
const { mentionsTravail } = require('../src/utils/mentions');

describe('formatRang', () => {
  test('1 → « 1er »', () => assert.equal(formatRang(1), '1er'));
  test('2, 3, 21 → « nème »', () => {
    assert.equal(formatRang(2), '2ème');
    assert.equal(formatRang(3), '3ème');
    assert.equal(formatRang(21), '21ème');
  });
  test('null / undefined / NaN → « — »', () => {
    assert.equal(formatRang(null), '—');
    assert.equal(formatRang(undefined), '—');
    assert.equal(formatRang(Number.NaN), '—');
  });
  test('rang décimal est tronqué', () => assert.equal(formatRang(2.9), '2ème'));
});

describe('mentionsTravail', () => {
  test('moyenne null → rien', () => {
    const m = mentionsTravail(null);
    assert.ok(Object.values(m).every((v) => v === false));
  });
  test('>= 16 → Félicitation (exclusive)', () => {
    const m = mentionsTravail(17);
    assert.equal(m.thomFelicitation, true);
    assert.equal(m.tableauHonneur, false);
    assert.equal(m.thomEncouragement, false);
  });
  test('14 à 16 → Tableau d’Honneur', () => {
    const m = mentionsTravail(14.5);
    assert.equal(m.tableauHonneur, true);
    assert.equal(m.thomFelicitation, false);
  });
  test('12 à 14 → T.H + Encouragement', () => {
    const m = mentionsTravail(12.3);
    assert.equal(m.thomEncouragement, true);
    assert.equal(m.avertissementTravail, false);
  });
  test('8 à 12 → aucune mention', () => {
    const m = mentionsTravail(9);
    assert.ok(Object.values(m).every((v) => v === false));
  });
  test('6 à 8 → Avertissement Travail', () => {
    const m = mentionsTravail(6.5);
    assert.equal(m.avertissementTravail, true);
    assert.equal(m.blameTravail, false);
  });
  test('< 6 → Blâme Travail', () => {
    const m = mentionsTravail(4.2);
    assert.equal(m.blameTravail, true);
    assert.equal(m.avertissementTravail, false);
  });
});
