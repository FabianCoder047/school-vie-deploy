// =====================================================================
// Tests d'intégration — fiches de proclamation : génération PDF par le
// Directeur et protection par le feu vert pour la Secrétaire.
// Base de test dédiée (process séparé avec node --test).
// =====================================================================
process.env.TEST_DB_NAME = 'school_vie_test_proclamation_db_004774';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { creerBase, supprimerBase, app, query, request } = require('./setup');

let agent;
const state = {};

before(async () => {
  await creerBase();
  agent = request(app());
});

after(async () => {
  await supprimerBase();
  try { await require('../src/config/db').end(); } catch (_e) { /* ignore */ }
});

async function connecter(identifier, password, nouveauMotDePasse) {
  const login = await agent.post('/api/auth/login').send({ identifier, password });
  assert.equal(login.status, 200, `login ${identifier}`);
  const change = await agent.post('/api/auth/change-password')
    .set('Authorization', `Bearer ${login.body.accessToken}`)
    .send({ currentPassword: password, newPassword: nouveauMotDePasse });
  assert.equal(change.status, 200, `change-password ${identifier}`);
  return change.body.accessToken;
}

test('préparation : admin, directeur, secrétaire, alias et période', async () => {
  state.adminToken = await connecter('admin@test.local', process.env.ADMIN_PASSWORD, 'AdminProc2026!');

  const dir = await agent.post('/api/admin/directeurs')
    .set('Authorization', `Bearer ${state.adminToken}`)
    .send({ role: 'DIRECTEUR', nom: 'DirProc', prenom: 'Test', email: 'dir-proc@test.local' });
  assert.equal(dir.status, 201);
  state.directeurToken = await connecter('dir-proc@test.local', dir.body.motDePasseTemporaire, 'DirProc2026!');

  const sec = await agent.post('/api/directeur/utilisateurs')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ role: 'SECRETAIRE', nom: 'SecProc', prenom: 'Test', email: 'sec-proc@test.local' });
  assert.equal(sec.status, 201);
  state.secretaireToken = await connecter('sec-proc@test.local', sec.body.motDePasseTemporaire, 'SecProc2026!');

  const alias = await agent.post('/api/directeur/alias')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ class_id: 1, nom: 'CP1 A', capacite: 45 });
  assert.equal(alias.status, 201);
  state.aliasId = alias.body.id;

  await query(
    `INSERT INTO evaluation_periods (academic_year_id, libelle, ordre, date_debut, date_fin)
     SELECT id, 'Trimestre 1', 1, '2026-09-01', '2026-12-20' FROM academic_years WHERE is_current = 1`
  );
  const [[periode]] = await query('SELECT id FROM evaluation_periods WHERE libelle = ?', ['Trimestre 1']);
  state.periodeId = periode.id;
  state.url = `/api/directeur/proclamations/alias/${state.aliasId}?evaluation_period_id=${state.periodeId}`;
  state.urlSecretaire = state.url.replace('/directeur/', '/secretaire/');
});

test('Directeur : génération du PDF de proclamation (200, application/pdf)', async () => {
  const res = await agent.get(state.url).set('Authorization', `Bearer ${state.directeurToken}`);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /application\/pdf/);
  assert.match(res.headers['content-disposition'], /fiche-proclamation-CP1-A\.pdf/);
});

test('Secrétaire : 403 tant que le feu vert n’est pas donné', async () => {
  const res = await agent.get(state.urlSecretaire).set('Authorization', `Bearer ${state.secretaireToken}`);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'IMPRESSION_NON_AUTORISEE');
});

test('Directeur : feu vert dédié aux fiches de proclamation', async () => {
  const res = await agent.put('/api/directeur/impressions/proclamations')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ autorisee: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.parametres.proclamations_impression_autorisee, 1);

  const params = await agent.get('/api/parametres').set('Authorization', `Bearer ${state.secretaireToken}`);
  assert.equal(params.status, 200);
  assert.equal(params.body.proclamations_impression_autorisee, 1);
});

test('Secrétaire : 200 après feu vert, puis 403 après révocation', async () => {
  const ok = await agent.get(state.urlSecretaire).set('Authorization', `Bearer ${state.secretaireToken}`);
  assert.equal(ok.status, 200);
  assert.match(ok.headers['content-type'], /application\/pdf/);

  const retrait = await agent.put('/api/directeur/impressions/proclamations')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ autorisee: false });
  assert.equal(retrait.status, 200);
  assert.equal(retrait.body.parametres.proclamations_impression_autorisee, 0);

  const bloque = await agent.get(state.urlSecretaire).set('Authorization', `Bearer ${state.secretaireToken}`);
  assert.equal(bloque.status, 403);
  assert.equal(bloque.body.code, 'IMPRESSION_NON_AUTORISEE');
});

test('une période est obligatoire (400)', async () => {
  const res = await agent.get(`/api/directeur/proclamations/alias/${state.aliasId}`)
    .set('Authorization', `Bearer ${state.directeurToken}`);
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'PARAMS_REQUIS');
});
