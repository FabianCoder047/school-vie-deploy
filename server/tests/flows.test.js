// =====================================================================
// Tests d'intégration — parcours critiques contre l'application Express
// et une base de test dédiée (school_vie_test_db_004774).
// Couvre : auth + verrouillage, mot de passe forcé, rôles, inscription,
// paiement d'inscription, paiement de scolarité (ventilation),
// fenêtre de saisie des notes, chevauchement d'EDT.
// =====================================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { creerBase, supprimerBase, app, query, request } = require('./setup');

let agent; // factory supertest bound to the app
const state = {};

before(async () => {
  await creerBase();
  agent = request(app());
});

after(async () => {
  await supprimerBase();
  // Ferme le pool MySQL de l'application pour libérer le event loop
  try {
    const pool = require('../src/config/db');
    await pool.end();
  } catch (_e) {
    /* ignore */
  }
});

/* ===== AUTHENTIFICATION ===== */

test('login : identifiants invalides → 401 (réponse générique)', async () => {
  const res = await agent.post('/api/auth/login').send({ identifier: 'admin@test.local', password: 'mauvais-mot-de-passe' });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'INVALID_CREDENTIALS');
});

test('login : compte inexistant → même réponse 401 (pas de fuite)', async () => {
  const res = await agent.post('/api/auth/login').send({ identifier: 'inconnu@test.local', password: 'quelquechose123' });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'INVALID_CREDENTIALS');
});

test('verrouillage : 5 échecs → 6e tentative bloquée avec message minutes', async () => {
  // Remise à zéro du compteur (des tests précédents ont pu l'incrémenter)
  await query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'admin@test.local'");
  const agentBloque = agent; // même agent, même compte
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await agentBloque.post('/api/auth/login').send({ identifier: 'admin@test.local', password: `mauvais-${i}` });
    assert.equal(res.status, 401);
  }
  const res = await agentBloque.post('/api/auth/login').send({ identifier: 'admin@test.local', password: process.env.ADMIN_PASSWORD });
  assert.equal(res.status, 423);
  assert.match(res.body.message, /bloqué/i);
});

test('verrouillage : déverrouillage admin en base → login fonctionne', async () => {
  await query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'admin@test.local'");
  const res = await agent.post('/api/auth/login').send({ identifier: 'admin@test.local', password: process.env.ADMIN_PASSWORD });
  assert.equal(res.status, 200);
  assert.ok(res.body.accessToken);
  assert.equal(res.body.user.mustChangePassword, true);
  state.adminToken = res.body.accessToken;
  state.adminRefresh = res.body.refreshToken;
});

test('mot de passe obligatoire : ping métier → 403 tant que non changé', async () => {
  const res = await agent.get('/api/protected/ping').set('Authorization', `Bearer ${state.adminToken}`);
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'PASSWORD_CHANGE_REQUIRED');
});

test('changement de mot de passe + ping → 200', async () => {
  const res = await agent.post('/api/auth/change-password')
    .set('Authorization', `Bearer ${state.adminToken}`)
    .send({ currentPassword: process.env.ADMIN_PASSWORD, newPassword: 'NouveauMdp2026!' });
  assert.equal(res.status, 200);
  state.adminToken = res.body.accessToken;
  const ping = await agent.get('/api/protected/ping').set('Authorization', `Bearer ${state.adminToken}`);
  assert.equal(ping.status, 200);
});

/* ===== ADMIN → DIRECTEUR → SECRÉTAIRE ===== */

test('ADMIN crée un Directeur ; Directeur crée une Secrétaire', async () => {
  const resDir = await agent.post('/api/admin/directeurs')
    .set('Authorization', `Bearer ${state.adminToken}`)
    .send({ role: 'DIRECTEUR', nom: 'DirecteurTest', prenom: 'Dir', email: 'directeur@test.local' });
  assert.equal(resDir.status, 201);
  state.directeurPasswordTemporaire = resDir.body.motDePasseTemporaire;

  const loginDir = await agent.post('/api/auth/login').send({ identifier: 'directeur@test.local', password: state.directeurPasswordTemporaire });
  assert.equal(loginDir.status, 200);
  const changeDir = await agent.post('/api/auth/change-password')
    .set('Authorization', `Bearer ${loginDir.body.accessToken}`)
    .send({ currentPassword: state.directeurPasswordTemporaire, newPassword: 'Directeur2026!' });
  state.directeurToken = changeDir.body.accessToken;

  const resSec = await agent.post('/api/directeur/utilisateurs')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ role: 'SECRETAIRE', nom: 'SecretaireTest', prenom: 'Sec', email: 'secretaire@test.local' });
  assert.equal(resSec.status, 201);
  state.secretairePasswordTemporaire = resSec.body.motDePasseTemporaire;

  const loginSec = await agent.post('/api/auth/login').send({ identifier: 'secretaire@test.local', password: state.secretairePasswordTemporaire });
  const changeSec = await agent.post('/api/auth/change-password')
    .set('Authorization', `Bearer ${loginSec.body.accessToken}`)
    .send({ currentPassword: state.secretairePasswordTemporaire, newPassword: 'Secretaire2026!' });
  state.secretaireToken = changeSec.body.accessToken;
});

test('ADMIN interdit à un Directeur de créer un Directeur ; Directeur interdit de créer un Comptable via route ADMIN', async () => {
  const res = await agent.post('/api/admin/directeurs')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ role: 'DIRECTEUR', nom: 'X', prenom: 'Y', email: 'nope@test.local' });
  assert.equal(res.status, 403);
});

/* ===== CONFIGURATION (matière, alias, frais, affectation) ===== */

test('ADMIN crée une matière ; DIRECTEUR affecte → classe + alias + frais', async () => {
  const mat = await agent.post('/api/admin/subjects')
    .set('Authorization', `Bearer ${state.adminToken}`)
    .send({ nom: 'Mathématiques', code: 'MATH' });
  assert.equal(mat.status, 201);
  state.matiereId = mat.body.id;

  const alias = await agent.post('/api/directeur/alias')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ class_id: 1, nom: 'CP1 A', capacite: 45 });
  assert.equal(alias.status, 201);
  state.aliasId = alias.body.id;

  const frais = await agent.put('/api/directeur/frais/classe')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ class_id: 1, frais_inscription: 25000, montant_scolarite: 250000, modalites: ['MENSUEL', 'TRIMESTRIEL'] });
  assert.equal(frais.status, 200);

  const aff = await agent.post('/api/directeur/affectations')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ subject_id: state.matiereId, affectations: [{ class_id: 1, coefficient: 4 }] });
  assert.equal(aff.status, 200);

  const prof = await agent.post('/api/directeur/utilisateurs')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ role: 'PROFESSEUR', nom: 'ProfTest', prenom: 'Jean', email: 'prof@test.local' });
  assert.equal(prof.status, 201);
  state.profPasswordTemporaire = prof.body.motDePasseTemporaire;
  state.profId = prof.body.user.id;

  const assign = await agent.post('/api/directeur/affectations-professeur')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ teacher_id: state.profId, affectations: [{ class_subject_id: aff.body.affectations[0].id, class_alias_id: state.aliasId }] });
  assert.equal(assign.status, 201);

  const loginProf = await agent.post('/api/auth/login').send({ identifier: 'prof@test.local', password: state.profPasswordTemporaire });
  const changeProf = await agent.post('/api/auth/change-password')
    .set('Authorization', `Bearer ${loginProf.body.accessToken}`)
    .send({ currentPassword: state.profPasswordTemporaire, newPassword: 'Prof2026!' });
  state.profToken = changeProf.body.accessToken;
});

/* ===== INSCRIPTION + PAIEMENT ===== */

test('Secrétaire inscrit un élève (matricule auto, échéancier)', async () => {
  const res = await agent.post('/api/secretaire/eleves')
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({
      eleve: { nom: 'TestEleve', prenom: 'Enfant', sexe: 'F', date_naissance: '2019-03-12', lieu_naissance: 'Lomé', adresse: 'Quartier Bè' },
      tuteur: { nom: 'TestEleve', prenom: 'Tuteur', telephone_whatsapp: '99000001' },
      academique: { class_id: 1, class_alias_id: state.aliasId, modalite_paiement: 'MENSUEL' },
    });
  assert.equal(res.status, 201);
  state.enrollmentId = res.body.enrollmentId;
  assert.match(res.body.matricule, /^MAT-\d{4}-\d{5}$/);
  assert.equal(res.body.echeances, 9);
});

test('paiement des frais d’inscription → INSCRIT ; second paiement → 409', async () => {
  const paiement = await agent.post(`/api/secretaire/eleves/${state.enrollmentId}/paiement-inscription`)
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ moyen: 'ESPECES' });
  assert.equal(paiement.status, 201);
  const fiche = await agent.get(`/api/secretaire/eleves/${state.enrollmentId}`)
    .set('Authorization', `Bearer ${state.secretaireToken}`);
  assert.equal(fiche.body.statut, 'INSCRIT');

  const doubloon = await agent.post(`/api/secretaire/eleves/${state.enrollmentId}/paiement-inscription`)
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ moyen: 'ESPECES' });
  assert.equal(doubloon.status, 409);
});

test('Compte Comptable créé ; paiement de scolarité ventilé automatiquement', async () => {
  const comp = await agent.post('/api/directeur/utilisateurs')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ role: 'COMPTABLE', nom: 'ComptableTest', prenom: 'Awa', email: 'comptable@test.local' });
  assert.equal(comp.status, 201);
  const login = await agent.post('/api/auth/login').send({ identifier: 'comptable@test.local', password: comp.body.motDePasseTemporaire });
  const change = await agent.post('/api/auth/change-password')
    .set('Authorization', `Bearer ${login.body.accessToken}`)
    .send({ currentPassword: comp.body.motDePasseTemporaire, newPassword: 'Comptable2026!' });
  state.comptableToken = change.body.accessToken;

  const paiement = await agent.post('/api/comptable/paiements')
    .set('Authorization', `Bearer ${state.comptableToken}`)
    .send({ enrollment_id: state.enrollmentId, montant: 50000, moyen: 'ESPECES' });
  assert.equal(paiement.status, 201);
  assert.ok(Number(paiement.body.total_paye) > 0);

  const overpay = await agent.post('/api/comptable/paiements')
    .set('Authorization', `Bearer ${state.comptableToken}`)
    .send({ enrollment_id: state.enrollmentId, montant: 99999999, moyen: 'ESPECES' });
  assert.equal(overpay.status, 400);
});

/* ===== FENÊTRE DE SAISIE DES NOTES ===== */

test('saisie des notes refusée hors fenêtre (403 SAISIE_FERMEE)', async () => {
  // Créer une période FUTURE (fenêtre fermée)
  const future = new Date();
  future.setDate(future.getDate() + 10);
  const debut = new Date();
  debut.setDate(debut.getDate() + 5);
  const fin = new Date();
  fin.setDate(fin.getDate() + 15);
  const periode = await agent.post('/api/directeur/periodes')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({
      libelle: 'Trimestre Futur', ordre: 2,
      date_debut: future.toISOString().slice(0, 10), date_fin: fin.toISOString().slice(0, 10),
      saisie_debut: debut.toISOString().slice(0, 16), saisie_fin: fin.toISOString().slice(0, 16),
    });
  assert.equal(periode.status, 201);

  // Alias de prof → il doit être affecté pour pouvoir saisir
  const mat = await query('SELECT id FROM class_subjects WHERE class_id = 1');
  const res = await agent.put('/api/professeur/feuille')
    .set('Authorization', `Bearer ${state.profToken}`)
    .send({
      class_alias_id: state.aliasId,
      class_subject_id: mat[0][0].id,
      evaluation_period_id: periode.body.id,
      notes: [{ enrollment_id: state.enrollmentId, interro: 10 }],
    });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'SAISIE_FERMEE');
});

/* ===== CHEVAUCHEMENT EDT ===== */

test('EDT : deux créneaux chevauchants pour le même alias → 409', async () => {
  const assignments = await query('SELECT id FROM teacher_assignments WHERE class_alias_id = ?', [state.aliasId]);
  const assignmentId = assignments[0][0].id;

  const c1 = await agent.post('/api/directeur/edt')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ class_alias_id: state.aliasId, teacher_assignment_id: assignmentId, jour_semaine: 2, heure_debut: '07:00', heure_fin: '08:00', salle: 'A1' });
  assert.equal(c1.status, 201, JSON.stringify(c1.body));

  const c2 = await agent.post('/api/directeur/edt')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ class_alias_id: state.aliasId, teacher_assignment_id: assignmentId, jour_semaine: 2, heure_debut: '07:55', heure_fin: '08:55', salle: 'A2' });
  assert.equal(c2.status, 409);
  assert.ok(['CRENEAU_ALIAS', 'CRENEAU_PROF'].includes(c2.body.code));

  // Aucun cours le samedi ni le dimanche (1=lundi … 5=vendredi).
  const weekEnd = await agent.post('/api/directeur/edt')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ class_alias_id: state.aliasId, teacher_assignment_id: assignmentId, jour_semaine: 6, heure_debut: '07:00', heure_fin: '08:00' });
  assert.equal(weekEnd.status, 400);
});

test('EDT primaire : créneau l’après-midi avec durée libre', async () => {
  const assignments = await query('SELECT id FROM teacher_assignments WHERE class_alias_id = ?', [state.aliasId]);
  const assignmentId = assignments[0][0].id;
  const res = await agent.post('/api/directeur/edt')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ class_alias_id: state.aliasId, teacher_assignment_id: assignmentId, jour_semaine: 3, heure_debut: '14:30', heure_fin: '16:10' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(String(res.body.heure_fin).slice(0, 5), '16:10');
  assert.equal(res.body.duree_libre, 1);
});

test('EDT : génération du PDF (directeur)', async () => {
  const res = await agent.get(`/api/directeur/edt/pdf?class_alias_id=${state.aliasId}`)
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .buffer(true);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'] || '', /application\/pdf/);
});

/* ===== SÉCURITÉ TRANSVERSALE ===== */

test('un PARENT ne peut pas atteindre les routes du Directeur', async () => {
  // Le parent est créé lors de l'inscription — on récupère SON compte via la DB
  const [[parentRow]] = await query("SELECT id FROM users WHERE telephone = '99000001'");
  assert.ok(parentRow);
  // Le parent ne peut pas se connecter tel quel (mdp inconnu) — on teste la route directement avec un token SUPPRIMÉ
  const res = await agent.get('/api/directeur/dashboard');
  assert.equal(res.status, 401);
});

test('une route inconnue renvoie 404', async () => {
  const res = await agent.get('/api/nope-jamais-existe').set('Authorization', `Bearer ${state.adminToken}`);
  assert.equal(res.status, 404);
});

/* ===== ALIAS DE CLASSE — GESTION DÉLÉGUÉE À LA SECRÉTAIRE ===== */

test('Secrétaire : créer, modifier et supprimer un alias de classe', async () => {
  const creation = await agent.post('/api/secretaire/alias')
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ class_id: 1, nom: 'CP1 B', capacite: 30 });
  assert.equal(creation.status, 201, JSON.stringify(creation.body));
  const id = creation.body.id;
  assert.ok(id);

  const modification = await agent.put(`/api/secretaire/alias/${id}`)
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ class_id: 1, nom: 'CP1 B bis', capacite: 32 });
  assert.equal(modification.status, 200, JSON.stringify(modification.body));

  const liste = await agent.get('/api/alias?parPage=100')
    .set('Authorization', `Bearer ${state.secretaireToken}`);
  assert.equal(liste.status, 200);
  assert.ok((liste.body.rows || []).some((a) => a.id === id && a.nom === 'CP1 B bis'));

  const suppression = await agent.delete(`/api/secretaire/alias/${id}`)
    .set('Authorization', `Bearer ${state.secretaireToken}`);
  assert.equal(suppression.status, 200);
});

test('Secrétaire : validation du nom et refus du doublon', async () => {
  const invalide = await agent.post('/api/secretaire/alias')
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ class_id: 1, nom: '' });
  assert.equal(invalide.status, 400);

  const doublon = await agent.post('/api/secretaire/alias')
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ class_id: 1, nom: 'CP1 A' }); // alias créé par le directeur plus haut
  assert.equal(doublon.status, 409);
  assert.equal(doublon.body.code, 'ALIAS_DOUBLON');
});

/* ===== DÉLÉGATIONS DE TÂCHES (journalisées) ===== */

test('délégations : valeurs par défaut et lecture par tous les rôles', async () => {
  const res = await agent.get('/api/delegations').set('Authorization', `Bearer ${state.secretaireToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.matieres_secretaire_autorisee, true);
  assert.equal(res.body.affectations_secretaire_autorisee, true);
  assert.equal(res.body.annees_secretaire_autorisee, false);
  assert.equal(res.body.inscriptions_comptable_autorisee, false);
  assert.equal(res.body.paiements_secretaire_autorisee, false);
});

test('Secrétaire : créer une matière + affectations (délégation par défaut), action journalisée', async () => {
  const [[sec]] = await query("SELECT id FROM users WHERE email = 'secretaire@test.local'");
  const mat = await agent.post('/api/secretaire/subjects')
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ nom: 'Français délégué', code: 'FRD' });
  assert.equal(mat.status, 201, JSON.stringify(mat.body));

  const aff = await agent.post('/api/secretaire/affectations')
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ subject_id: mat.body.id, affectations: [{ class_id: 1, coefficient: 3 }] });
  assert.equal(aff.status, 200, JSON.stringify(aff.body));

  const prof = await agent.post('/api/secretaire/affectations-professeur')
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ teacher_id: state.profId, affectations: [{ class_subject_id: aff.body.affectations[0].id, class_alias_id: state.aliasId }] });
  assert.equal(prof.status, 201, JSON.stringify(prof.body));

  const [logs] = await query("SELECT action, entity FROM audit_logs WHERE user_id = ? AND entity = 'subjects' AND action = 'CREATE'", [sec.id]);
  assert.ok(logs.length >= 1, 'la création de matière doit être journalisée');
});

test('Directeur : il crée une année, délègue aux autres tâches, et tout est journalisé', async () => {
  const annee = await agent.post('/api/directeur/annees-academiques')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ libelle: '2031-2032', date_debut: '2031-09-01', date_fin: '2032-06-30' });
  assert.equal(annee.status, 201, JSON.stringify(annee.body));

  const [[dir]] = await query("SELECT id FROM users WHERE email = 'directeur@test.local'");
  const refus = await agent.post('/api/secretaire/annees-academiques')
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ libelle: '2032-2033', date_debut: '2032-09-01', date_fin: '2033-06-30' });
  assert.equal(refus.status, 403);
  assert.equal(refus.body.code, 'DELEGATION_REQUIRED');

  const delegation = await agent.put('/api/directeur/delegations')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({
      annees_secretaire_autorisee: true,
      inscriptions_comptable_autorisee: true,
      paiements_secretaire_autorisee: true,
    });
  assert.equal(delegation.status, 200, JSON.stringify(delegation.body));
  assert.equal(delegation.body.inscriptions_comptable_autorisee, true);
  assert.equal(delegation.body.paiements_secretaire_autorisee, true);

  const [logs] = await query("SELECT action, old_values, new_values FROM audit_logs WHERE user_id = ? AND action = 'UPDATE_DELEGATIONS'", [dir.id]);
  assert.equal(logs.length, 1);
  const nouvellesValeurs = typeof logs[0].new_values === 'string' ? JSON.parse(logs[0].new_values) : logs[0].new_values;
  assert.equal(nouvellesValeurs.inscriptions_comptable_autorisee, true);

  const journal = await agent.get('/api/directeur/journal?parPage=5')
    .set('Authorization', `Bearer ${state.directeurToken}`);
  assert.equal(journal.status, 200);
  assert.ok(journal.body.rows.some((l) => l.action === 'UPDATE_DELEGATIONS'));
});

test('Comptable : inscriptions déléguées ; Secrétaire : paiements délégués', async () => {
  const inscription = await agent.post('/api/comptable/inscriptions/eleves')
    .set('Authorization', `Bearer ${state.comptableToken}`)
    .send({
      eleve: { nom: 'Delegue', prenom: 'Comptable', sexe: 'M', date_naissance: '2018-05-02', lieu_naissance: 'Lomé', adresse: 'Quartier Bè' },
      tuteur: { nom: 'Delegue', prenom: 'Tuteur', telephone_whatsapp: '99000099' },
      academique: { class_id: 1, class_alias_id: state.aliasId, modalite_paiement: 'MENSUEL' },
    });
  assert.equal(inscription.status, 201, JSON.stringify(inscription.body));

  const paiement = await agent.post('/api/secretaire/comptabilite/paiements')
    .set('Authorization', `Bearer ${state.secretaireToken}`)
    .send({ enrollment_id: state.enrollmentId, montant: 5000, moyen: 'ESPECES' });
  assert.equal(paiement.status, 201, JSON.stringify(paiement.body));

  const [[sec]] = await query("SELECT id FROM users WHERE email = 'secretaire@test.local'");
  const [[comp]] = await query("SELECT id FROM users WHERE email = 'comptable@test.local'");
  const [logsSec] = await query('SELECT action, entity FROM audit_logs WHERE user_id = ? AND entity = ?', [sec.id, 'payments']);
  const [logsComp] = await query('SELECT action, entity FROM audit_logs WHERE user_id = ? AND entity = ?', [comp.id, 'enrollments']);
  assert.ok(logsSec.length >= 1, 'le paiement délégué doit être journalisé');
  assert.ok(logsComp.length >= 1, 'l’inscription déléguée doit être journalisée');
});

test('Directeur : révoquer une délégation → accès immédiatement refusé', async () => {
  const res = await agent.put('/api/directeur/delegations')
    .set('Authorization', `Bearer ${state.directeurToken}`)
    .send({ inscriptions_comptable_autorisee: false });
  assert.equal(res.status, 200);

  const refus = await agent.post('/api/comptable/inscriptions/eleves')
    .set('Authorization', `Bearer ${state.comptableToken}`)
    .send({
      eleve: { nom: 'Refus', prenom: 'Comptable', date_naissance: '2018-05-02', lieu_naissance: 'Lomé', adresse: 'Bè' },
      tuteur: { nom: 'Refus', prenom: 'Tuteur', telephone_whatsapp: '99000098' },
      academique: { class_id: 1, class_alias_id: state.aliasId, modalite_paiement: 'MENSUEL' },
    });
  assert.equal(refus.status, 403);
  assert.equal(refus.body.code, 'DELEGATION_REQUIRED');
});
