// Tests unitaires — fiches de proclamation (décision indicative + classement).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { decisionProclamation, trierParRang } = require('../src/services/proclamationService');

describe('decisionProclamation', () => {
  test('moyenne >= 10 → ADMIS', () => {
    assert.deepEqual(decisionProclamation(10), { libelle: 'ADMIS', admis: true, evalue: true });
    assert.equal(decisionProclamation(15.25).libelle, 'ADMIS');
  });
  test('moyenne < 10 → REDOUBLE', () => {
    assert.deepEqual(decisionProclamation(9.99), { libelle: 'REDOUBLE', admis: false, evalue: true });
    assert.equal(decisionProclamation(0).libelle, 'REDOUBLE');
  });
  test('moyenne absente ou invalide → non évalué', () => {
    for (const v of [null, undefined, Number.NaN, 'abc']) {
      const d = decisionProclamation(v);
      assert.equal(d.libelle, '—');
      assert.equal(d.admis, false);
      assert.equal(d.evalue, false);
    }
  });
});

describe('trierParRang', () => {
  test('rangs croissants, ex æquo départagés par nom, non classés en fin', () => {
    const eleves = [
      { nom: 'Zorro', prenom: 'Alain', rang: null },
      { nom: 'Bamba', prenom: 'Kofi', rang: 1 },
      { nom: 'Adjo', prenom: 'Ama', rang: 1 },
      { nom: 'Doe', prenom: 'John', rang: 3 },
    ];
    assert.deepEqual(trierParRang(eleves).map((e) => e.nom), ['Adjo', 'Bamba', 'Doe', 'Zorro']);
  });
  test('ne modifie pas le tableau source', () => {
    const eleves = [{ nom: 'B', rang: 2 }, { nom: 'A', rang: 1 }];
    trierParRang(eleves);
    assert.deepEqual(eleves.map((e) => e.nom), ['B', 'A']);
  });
});
