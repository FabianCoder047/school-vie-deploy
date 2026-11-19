// Tests unitaires — utils/dates (normalisation 'YYYY-MM-DD').
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { ymd } = require('../src/utils/dates');

describe('ymd', () => {
  test('Date native → YYYY-MM-DD', () => {
    assert.equal(ymd(new Date(2026, 9, 1)), '2026-10-01');
    assert.equal(ymd(new Date(2026, 10, 17)), '2026-11-17');
  });
  test('chaîne ISO (DATE mysql2) → conservée', () => {
    assert.equal(ymd('2026-10-01'), '2026-10-01');
    assert.equal(ymd('2026-10-01 00:00:00'), '2026-10-01');
    assert.equal(ymd('2026-10-01T00:00:00.000Z'), '2026-10-01');
  });
  test('dates invalides → borne haute', () => {
    assert.equal(ymd('nope'), '9999-12-31');
    assert.equal(ymd(null), '9999-12-31');
  });
  test('comparaison lexicographique (le cas du bug « Thu Oct 01 »)', () => {
    // Avant le correctif, String(new Date(2026,9,1)).slice(0,10) = « Thu Oct 01 »
    // qui passait pour postérieur à « 2026-11-18 » — tous les comptes
    // ressortaient « à jour ».
    const oct = ymd(new Date(2026, 9, 1));
    const nov = ymd(new Date(2026, 10, 18));
    assert.equal(ymd(new Date(2026, 9, 1)) < ymd('2026-11-18'), true);
    assert.equal(oct < nov, true);
  });
});
