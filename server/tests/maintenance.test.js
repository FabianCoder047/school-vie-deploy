// =====================================================================
// Tests d'intégration — fenêtre de maintenance.
// Vérifie que PENDANT la maintenance :
//  - tout le monde est refusé (503 MAINTENANCE) sauf le rôle ADMIN ;
//  - la connexion et le refresh des non-admins sont refusés ;
//  - l'ADMIN garde un accès complet ;
//  - le statut public répond toujours (page de garde du front) ;
//  - terminer la maintenance rétablit l'accès.
// =====================================================================
// Base jetable dédiée : les fichiers de test tournent en parallèle.
process.env.TEST_DB_NAME = 'school_vie_maintenance_test_db_004774';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { creerBase, supprimerBase, app, query, request } = require('./setup');

let agent;
const state = {};

before(async () => {
  await creerBase();
  agent = request(app());
  // L'admin seedé doit changer son mot de passe avant tout accès métier.
  const login = await agent.post('/api/auth/login')
    .send({ identifier: 'admin@test.local', password: process.env.ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  const change = await agent.post('/api/auth/change-password')
    .set('Authorization', `Bearer ${login.body.accessToken}`)
    .send({ currentPassword: process.env.ADMIN_PASSWORD, newPassword: 'MaintenanceTest2026!' });
  assert.equal(change.status, 200);
  state.adminToken = change.body.accessToken;
  state.adminRefresh = change.body.refreshToken;

  // Un Directeur non-admin : peut se connecter et accéder à l'API.
  const resDir = await agent.post('/api/admin/directeurs')
    .set('Authorization', `Bearer ${state.adminToken}`)
    .send({ role: 'DIRECTEUR', nom: 'DirecteurMaintenance', prenom: 'Maint', email: 'directeur-maint@test.local' });
  assert.equal(resDir.status, 201);
  const loginDir = await agent.post('/api/auth/login')
    .send({ identifier: 'directeur-maint@test.local', password: resDir.body.motDePasseTemporaire });
  const changeDir = await agent.post('/api/auth/change-password')
    .set('Authorization', `Bearer ${loginDir.body.accessToken}`)
    .send({ currentPassword: resDir.body.motDePasseTemporaire, newPassword: 'DirecteurMaint2026!' });
  state.directeurToken = changeDir.body.accessToken;
  state.directeurRefresh = changeDir.body.refreshToken;
});

after(async () => {
  await supprimerBase();
  try {
    const pool = require('../src/config/db');
    await pool.end();
  } catch (_e) {
    /* ignore */
  }
});

test('statut public : inactif par défaut', async () => {
  const res = await agent.get('/api/maintenance/status');
  assert.equal(res.status, 200);
  assert.equal(res.body.active, false);
  assert.equal(res.body.etat, 'aucune');
});

test('PERIMETRE : admin définit une fenêtre de maintenance (maintenant → +2 h)', async () => {
  const debut = new Date(Date.now() - 60_000).toISOString();
  const fin = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const res = await agent.put('/api/admin/maintenance')
    .set('Authorization', `Bearer ${state.adminToken}`)
    .send({ debut, fin, message: 'Maintenance de test — merci de votre patience.' });
  assert.equal(res.status, 200);
  assert.equal(res.body.active, true);
  assert.equal(res.body.message, 'Maintenance de test — merci de votre patience.');
});

test('statut public : actif avec le message', async () => {
  const res = await agent.get('/api/maintenance/status');
  assert.equal(res.status, 200);
  assert.equal(res.body.active, true);
  assert.match(res.body.message, /Maintenance de test/);
  assert.ok(res.body.etablissement?.nom);
});

test('pendant la maintenance : le Directeur (non-admin) est refusé partout', async () => {
  const ping = await agent.get('/api/protected/ping')
    .set('Authorization', `Bearer ${state.directeurToken}`);
  assert.equal(ping.status, 503);
  assert.equal(ping.body.code, 'MAINTENANCE');

  const edt = await agent.get('/api/directeur/dashboard')
    .set('Authorization', `Bearer ${state.directeurToken}`);
  assert.equal(edt.status, 503);

  const anonyme = await agent.get('/api/protected/ping');
  assert.equal(anonyme.status, 503);
  assert.equal(anonyme.body.code, 'MAINTENANCE');
});

test('pendant la maintenance : login non-admin refusé (503 MAINTENANCE)', async () => {
  const res = await agent.post('/api/auth/login')
    .send({ identifier: 'directeur-maint@test.local', password: 'DirecteurMaint2026!' });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'MAINTENANCE');
});

test('pendant la maintenance : refresh non-admin refusé', async () => {
  const res = await agent.post('/api/auth/refresh')
    .send({ refreshToken: state.directeurRefresh });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'MAINTENANCE');
});

test('pendant la maintenance : l’ADMIN garde un accès complet', async () => {
  const ping = await agent.get('/api/protected/ping')
    .set('Authorization', `Bearer ${state.adminToken}`);
  assert.equal(ping.status, 200);

  const validation = await agent.get('/api/admin/maintenance')
    .set('Authorization', `Bearer ${state.adminToken}`);
  assert.equal(validation.status, 200);
  assert.equal(validation.body.active, true);

  const refresh = await agent.post('/api/auth/refresh')
    .send({ refreshToken: state.adminRefresh });
  assert.equal(refresh.status, 200);
  assert.ok(refresh.body.accessToken);
});

test('validation : la fin doit être postérieure au début', async () => {
  const debut = new Date(Date.now() + 3600 * 1000).toISOString();
  const fin = debut;
  const res = await agent.put('/api/admin/maintenance')
    .set('Authorization', `Bearer ${state.adminToken}`)
    .send({ debut, fin });
  assert.equal(res.status, 400);
});

test('l’ADMIN termine la maintenance : le Directeur retrouve l’accès', async () => {
  const fin = await agent.post('/api/admin/maintenance/terminer')
    .set('Authorization', `Bearer ${state.adminToken}`);
  assert.equal(fin.status, 200);
  assert.equal(fin.body.active, false);

  const ping = await agent.get('/api/protected/ping')
    .set('Authorization', `Bearer ${state.directeurToken}`);
  assert.equal(ping.status, 200);

  // La fenêtre est conservée en base (fin passée) — pas de fuite d'accès.
  const [[row]] = await query('SELECT maintenance_debut FROM school_settings WHERE id = 1');
  assert.ok(row.maintenance_debut);
});
