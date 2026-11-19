// =====================================================================
// SEEDER DE DÉMONSTRATION — élèves, professeurs, notes, absences et
// présences FICTIFS pour visualiser les bulletins et l'espace comptable.
//
// Tout ce qui est créé est répertorié dans .demo-manifest.json :
//   npm run demo:reset   → supprime précisément les données de démo et
//                          restaure les paramètres de l'école sauvegardés.
//
// Comptes créés (mot de passe : Demo12345!) :
//   prof.demo@demo.example.tg      (PROFESSEUR)
//   parent.demo@demo.example.tg    (PARENT, 8 enfants)
//   comptable.demo@demo.example.tg (COMPTABLE, espace comptabilité)
// Élèves : 8 élèves « DEMO-0001…DEMO-0008 » (classe CE1 A, année courante),
// avec échéanciers MENSUEL et quelques paiements d'inscription/scolarité.
// =====================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const MANIFEST = path.join(__dirname, '..', '.demo-manifest.json');
const DEMO_PASSWORD = 'Demo12345!';

// --- Générateur pseudo-aléatoire déterministe (même jeu de données à chaque run) ---
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const note = (rand, ability, difficulty) => clamp(Math.round((ability * difficulty + (rand() - 0.5) * 7) * 2) / 2, 0.5, 20);

const MATIERES = [
  { nom: 'Mathématiques', coefficient: 5, difficulte: 0.82 },
  { nom: 'Français', coefficient: 4, difficulte: 0.92 },
  { nom: 'Sciences de la Vie et de la Terre (SVT)', coefficient: 1, difficulte: 0.98 },
  { nom: 'Anglais', coefficient: 1, difficulte: 1.05 },
  { nom: 'Histoire-Géographie', coefficient: 1, difficulte: 1.0 },
  { nom: 'Éducation aux Droits de l’Homme et à la Citoyenneté', coefficient: 1, difficulte: 1.15 },
  { nom: 'Arts plastiques / dessin', coefficient: 2, difficulte: 1.25 },
  { nom: 'Éducation physique et sportive (EPS)', coefficient: 1, difficulte: 1.3 },
  { nom: 'Musique', coefficient: 1, difficulte: 1.25 },
  { nom: 'Technologie', coefficient: 1, difficulte: 1.0 },
];

const ELEVES = [
  { nom: 'KODJO', prenom: 'Messan', sexe: 'M', naissance: '2016-03-14', lieu: 'Lomé', adresse: 'Bè-Klikamé, Lomé', ability: 16.2 },
  { nom: 'AFI', prenom: 'Élodie', sexe: 'F', naissance: '2016-07-22', lieu: 'Lomé', adresse: 'Bè-Klikamé, Lomé', ability: 12.4 },
  { nom: 'YAWO', prenom: 'Kodjo Junior', sexe: 'M', naissance: '2016-11-02', lieu: 'Atakpamé', adresse: 'Atakpamé, quartier Agbledekpo', ability: 14.1 },
  { nom: 'AGBENYONUVO', prenom: 'Yao', sexe: 'M', naissance: '2016-01-30', lieu: 'Sokodé', adresse: 'Sokodé, quartier Zongo', ability: 9.3 },
  { nom: 'SENOU', prenom: 'Mariam', sexe: 'F', naissance: '2016-05-19', lieu: 'Lomé', adresse: 'Tokoin, Lomé', ability: 11.5 },
  { nom: 'ELO', prenom: 'Mawuéna', sexe: 'M', naissance: '2016-09-08', lieu: 'Kpalimé', adresse: 'Kpalimé, quartier Kpimé', ability: 17.6 },
  { nom: 'DOSSEH', prenom: 'Tsotso', sexe: 'M', naissance: '2016-12-25', lieu: 'Lomé', adresse: 'Adidogomé, Lomé', ability: 7.2 },
  { nom: 'AMOUZO', prenom: 'Laetitia', sexe: 'F', naissance: '2016-04-11', lieu: 'Tsévié', adresse: 'Tsévié, quartier centre', ability: 13.8 },
];

const rand = mulberry32(20261118);

(async () => {
  if (fs.existsSync(MANIFEST)) {
    console.error('Une installation de démonstration existe déjà. Lancez d’abord : npm run demo:reset');
    process.exit(1);
  }
  const DB_NAME = process.env.DB_NAME || 'school_vie_db_004774';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: DB_NAME,
  });
  const manifest = { created: { periodes: [], subjects: [], classSubjects: [], alias: null, teacherUserId: null, parentUserId: null, comptableUserId: null, guardianId: null, studentIds: [], enrollmentIds: [], teacherAssignmentIds: [], sessionIds: [] }, settingsBackup: null };
  const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  try {
    console.log(`Base ciblée : ${DB_NAME}`);

    // --- Année courante ---
    const [[annee]] = await conn.query('SELECT id, libelle, date_debut, date_fin FROM academic_years WHERE is_current = 1 LIMIT 1');
    if (!annee) throw new Error('Aucune année académique courante.');
    const [[classeCE1]] = await conn.query("SELECT id FROM classes WHERE nom = 'CE1' LIMIT 1");
    if (!classeCE1) throw new Error("La classe « CE1 » est introuvable (lancez d’abord le seed initial).");
    const [[directeur]] = await conn.query("SELECT id FROM users WHERE role = 'DIRECTEUR' ORDER BY id LIMIT 1");

    // --- Sauvegarde des paramètres de l'école (restaurés par demo:reset) ---
    const [[settings]] = await conn.query('SELECT * FROM school_settings WHERE id = 1');
    manifest.settingsBackup = settings || null;
    await conn.query(
      `UPDATE school_settings
          SET nom = 'École primaire publique de Bè-Klikamé', bp = '4521', ville = 'Lomé', pays = 'Togo',
              adresse = 'Rue des Écoles, Bè-Klikamé, Lomé', telephone = '22 26 40 10', email = 'ebk@example.tg'
        WHERE id = 1`
    );
    console.log('✓ Paramètres de l’école : école fictive togolaise (sauvegarde effectuée).');

    // --- Trimestres de l'année courante ---
    const periodesDef = [
      { libelle: 'Trimestre 1', ordre: 1, date_debut: '2026-09-14', date_fin: '2026-12-18', saisie_debut: '2026-09-14 00:00', saisie_fin: '2026-12-31 23:59' },
      { libelle: 'Trimestre 2', ordre: 2, date_debut: '2027-01-04', date_fin: '2027-03-26' },
      { libelle: 'Trimestre 3', ordre: 3, date_debut: '2027-04-19', date_fin: '2027-06-25' },
    ];
    for (const p of periodesDef) {
      const [r] = await conn.query(
        `INSERT INTO evaluation_periods (academic_year_id, libelle, ordre, date_debut, date_fin, saisie_debut, saisie_fin)
         SELECT ?, ?, ?, ?, ?, ?, ? FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM evaluation_periods WHERE academic_year_id = ? AND ordre = ?)`,
        [annee.id, p.libelle, p.ordre, p.date_debut, p.date_fin, p.saisie_debut || null, p.saisie_fin || null, annee.id, p.ordre]
      );
      if (r.affectedRows === 1) {
        const [[row]] = await conn.query('SELECT id FROM evaluation_periods WHERE academic_year_id = ? AND ordre = ?', [annee.id, p.ordre]);
        manifest.created.periodes.push(row.id);
      }
    }
    const [[t1]] = await conn.query('SELECT id FROM evaluation_periods WHERE academic_year_id = ? AND ordre = 1', [annee.id]);
    const [[t2]] = await conn.query('SELECT id FROM evaluation_periods WHERE academic_year_id = ? AND ordre = 2', [annee.id]);
    console.log('✓ Trimestres 1-3 prêts.');

    // --- Matières + coefficients CE1 ---
    const classSubjectIds = [];
    for (const m of MATIERES) {
      let [[subj]] = await conn.query('SELECT id FROM subjects WHERE nom = ?', [m.nom]);
      if (!subj) {
        const [r] = await conn.query('INSERT INTO subjects (nom) VALUES (?)', [m.nom]);
        subj = { id: r.insertId };
        manifest.created.subjects.push(subj.id);
      }
      const [r] = await conn.query(
        `INSERT INTO class_subjects (class_id, subject_id, coefficient)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE coefficient = VALUES(coefficient)`,
        [classeCE1.id, subj.id, m.coefficient]
      );
      const [[cs]] = await conn.query('SELECT id FROM class_subjects WHERE class_id = ? AND subject_id = ?', [classeCE1.id, subj.id]);
      if (r.affectedRows === 1 && r.insertId) manifest.created.classSubjects.push(cs.id);
      classSubjectIds.push({ ...m, class_subject_id: cs.id, subject_id: subj.id });
    }

    // --- Alias « CE1 A » ---
    let [[alias]] = await conn.query("SELECT id FROM class_aliases WHERE class_id = ? AND nom = 'CE1 A'", [classeCE1.id]);
    if (!alias) {
      const [r] = await conn.query('INSERT INTO class_aliases (class_id, nom, capacite) VALUES (?, ?, 45)', [classeCE1.id, 'CE1 A']);
      alias = { id: r.insertId };
      manifest.created.alias = alias.id;
    }

    // --- Comptes demo : professeur + parent ---
    const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const assurerCompte = async (cle, role, nom, prenom, email) => {
      const [[existe]] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existe) return existe.id;
      const [r] = await conn.query(
        `INSERT INTO users (role, nom, prenom, email, password_hash, must_change_password, is_active)
         VALUES (?, ?, ?, ?, ?, 0, 1)`,
        [role, nom, prenom, email, hash]
      );
      manifest.created[cle] = r.insertId; // suivi pour demo:reset uniquement si créé ici
      return r.insertId;
    };
    const teacherId = await assurerCompte('teacherUserId', 'PROFESSEUR', 'DEMO', 'Koffi', 'prof.demo@demo.example.tg');
    const parentId = await assurerCompte('parentUserId', 'PARENT', 'DEMO', 'Ayélé', 'parent.demo@demo.example.tg');
    const comptableId = await assurerCompte('comptableUserId', 'COMPTABLE', 'DEMO', 'Akossiwa', 'comptable.demo@demo.example.tg');

    // --- Tuteur commun (parent demo) ---
    let [[guardian]] = await conn.query('SELECT id FROM guardians WHERE telephone_whatsapp = ?', ['90000001']);
    if (!guardian) {
      const [r] = await conn.query(
        'INSERT INTO guardians (user_id, nom, prenom, telephone_whatsapp, email) VALUES (?, ?, ?, ?, ?)',
        [parentId, 'DEMO', 'Ayélé', '90000001', 'parent.demo@demo.example.tg']
      );
      guardian = { id: r.insertId };
      manifest.created.guardianId = guardian.id;
    }

    // --- 8 élèves + inscriptions ---
    const enrollments = [];
    for (let i = 0; i < ELEVES.length; i += 1) {
      const e = ELEVES[i];
      const matricule = `DEMO-${String(i + 1).padStart(4, '0')}`;
      let [[student]] = await conn.query('SELECT id FROM students WHERE matricule = ?', [matricule]);
      if (!student) {
        const [r] = await conn.query(
          `INSERT INTO students (matricule, nom, prenom, sexe, date_naissance, lieu_naissance, adresse, guardian_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [matricule, e.nom, e.prenom, e.sexe, e.naissance, e.lieu, e.adresse, guardian.id]
        );
        student = { id: r.insertId };
        manifest.created.studentIds.push(student.id);
      }
      const [[existeEnroll]] = await conn.query(
        'SELECT id FROM enrollments WHERE student_id = ? AND academic_year_id = ?',
        [student.id, annee.id]
      );
      let enrollmentId;
      if (existeEnroll) {
        enrollmentId = existeEnroll.id;
      } else {
        const [r] = await conn.query(
          `INSERT INTO enrollments (student_id, academic_year_id, class_id, class_alias_id, modalite_paiement, frais_inscription, montant_scolarite, statut, date_inscription, created_by)
           VALUES (?, ?, ?, ?, 'MENSUEL', 5000, 75000, 'INSCRIT', '2026-09-10', ?)`,
          [student.id, annee.id, classeCE1.id, alias.id, directeur?.id ?? manifest.created.teacherUserId]
        );
        enrollmentId = r.insertId;
        manifest.created.enrollmentIds.push(enrollmentId);
      }
      enrollments.push({ ...e, enrollmentId, matricule });
    }

    // --- Échéanciers de scolarité (MENSUEL) pour les élèves de démo ---
    const { genererEcheancier } = require('../src/utils/echeancier');
    const lignes = genererEcheancier({
      modalite: 'MENSUEL',
      montantScolarite: 75000,
      dateDebut: annee.date_debut,
      dateFin: annee.date_fin,
    });
    for (const enr of enrollments) {
      const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM payment_schedules WHERE enrollment_id = ?', [enr.enrollmentId]);
      if (n > 0) continue; // déjà présents (ré-exécution)
      for (const l of lignes) {
        await conn.query(
          'INSERT INTO payment_schedules (enrollment_id, numero, date_echeance, montant_du, montant_paye, statut) VALUES (?, ?, ?, ?, 0, ?)',
          [enr.enrollmentId, l.numero, l.date_echeance, l.montant_du, 'A_PAYER']
        );
      }
    }
    console.log(`✓ Échéanciers générés (MENSUEL, ${lignes.length} échéances par élève).`);

    // --- Paiements de démonstration (via le vrai service : ventilation auto) ---
    const paymentService = require('../src/services/paymentService');
    const IP_DEMO = '127.0.0.1';
    // [index élève (tri ELEVES), nombre de mensualités payées]
    const planPaiements = [
      { index: 0, mensualites: 2, moyen: 'ESPECES' },   // KODJO — à jour
      { index: 1, mensualites: 1, moyen: 'FLOOZ' },     // AFI — un mois
      { index: 2, mensualites: 0, moyen: 'ESPECES' },   // YAWO — rien en scolarité
      { index: 3, mensualites: 1, moyen: 'ESPECES' },   // AGBENYONUVO — un mois
      { index: 4, mensualites: 2, moyen: 'MIXX_BY_YAS' }, // SENOU — deux mois
      { index: 5, mensualites: 3, moyen: 'ESPECES' },   // ELO — trois mois
      { index: 6, mensualites: 0, moyen: 'FLOOZ' },     // DOSSEH — rien en scolarité (retard)
      { index: 7, mensualites: 1, moyen: 'ESPECES' },   // AMOUZO — un mois
    ];
    const montantEcheance = Number(lignes[0]?.montant_du ?? (75000 / 9).toFixed(2));
    for (const plan of planPaiements) {
      const enr = enrollments[plan.index];
      const [[dejaPaye]] = await conn.query(
        "SELECT COUNT(*) AS n FROM payments WHERE enrollment_id = ? AND type = 'INSCRIPTION' AND statut = 'VALIDE'",
        [enr.enrollmentId]
      );
      if (dejaPaye.n === 0) {
        await paymentService.payerFraisInscription(enr.enrollmentId, { moyen: plan.moyen, date_paiement: '2026-09-08 10:00:00' }, comptableId, IP_DEMO);
      }
      for (let m = 0; m < plan.mensualites; m += 1) {
        const [[deja]] = await conn.query(
          "SELECT COUNT(*) AS n FROM payments WHERE enrollment_id = ? AND type = 'SCOLARITE' AND statut = 'VALIDE'",
          [enr.enrollmentId]
        );
        if (deja.n >= plan.mensualites) break;
        const datesVersements = ['2026-10-05 09:30:00', '2026-10-26 14:00:00', '2026-11-08 09:30:00'];
        await paymentService.payerScolarite(
          { enrollment_id: enr.enrollmentId, montant: montantEcheance.toFixed(2), moyen: plan.moyen, date_paiement: datesVersements[m] || '2026-11-08 09:30:00' },
          comptableId,
          IP_DEMO
        );
      }
    }
    console.log('✓ Paiements fictifs enregistrés (inscriptions + mensualités, ventilation appliquée).');

    // --- Affectations du professeur (chaque matière × alias) ---
    const assignments = [];
    for (const cs of classSubjectIds) {
      const [[existante]] = await conn.query(
        'SELECT id FROM teacher_assignments WHERE academic_year_id = ? AND teacher_id = ? AND class_subject_id = ? AND class_alias_id = ?',
        [annee.id, teacherId, cs.class_subject_id, alias.id]
      );
      if (existante) {
        assignments.push({ ...cs, assignment_id: existante.id });
        continue;
      }
      const [r] = await conn.query(
        `INSERT INTO teacher_assignments (academic_year_id, teacher_id, class_subject_id, class_alias_id)
         VALUES (?, ?, ?, ?)`,
        [annee.id, teacherId, cs.class_subject_id, alias.id]
      );
      assignments.push({ ...cs, assignment_id: r.insertId });
      manifest.created.teacherAssignmentIds.push(r.insertId);
    }

    // --- Notes : Trimestre 1 et Trimestre 2 (Trimestre 3 volontairement vide) ---
    const noteDe = (enrollmentIndex, difficulty, abilityShift, periodeShift) => {
      const base = ELEVES[enrollmentIndex].ability + abilityShift + periodeShift;
      return note(rand, base, difficulty);
    };
    for (const periode of [{ p: t1, ordre: 1 }, { p: t2, ordre: 2 }]) {
      if (!periode.p) continue;
      for (const enr of enrollments) {
        const enrIndex = ELEVES.findIndex((e) => e.nom === enr.nom && e.prenom === enr.prenom);
        for (const cs of classSubjectIds) {
          const periodeShift = periode.ordre === 1 ? 0 : 0.4;
          const interro = noteDe(enrIndex, cs.difficulte, 1.5, periodeShift);
          const devoir = noteDe(enrIndex, cs.difficulte, -1, periodeShift);
          const compo = noteDe(enrIndex, cs.difficulte, 0, periodeShift);
          await conn.query(
            `INSERT INTO grades (enrollment_id, class_subject_id, evaluation_period_id, interro, devoir, compo, entered_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE interro = VALUES(interro), devoir = VALUES(devoir), compo = VALUES(compo)`,
            [enr.enrollmentId, cs.class_subject_id, periode.p.id, interro, devoir, compo, manifest.created.teacherUserId]
          );
        }
      }
    }
    console.log('✓ Notes des Trimestres 1 et 2 générées.');

    // --- Absences / retards (avec justifications variées) ---
    const assignmentMaths = assignments.find((a) => a.nom === 'Mathématiques')?.assignment_id;
    const assignmentFrancais = assignments.find((a) => a.nom === 'Français')?.assignment_id;
    const eff = (i) => enrollments[i].enrollmentId;
    const seances = [
      { date: '2026-10-05', heure: '08:00:00', assignment: assignmentMaths, records: [
        { enrollment_id: eff(1), statut: 'RETARD', minutes_retard: 10 },
        { enrollment_id: eff(2), statut: 'ABSENT', justification_statut: 'JUSTIFIEE', justification_par: 'PROFESSEUR', justification: 'Mot des parents apporté le jour même' },
      ] },
      { date: '2026-11-09', heure: '08:00:00', assignment: assignmentFrancais, records: [
        { enrollment_id: eff(0), statut: 'ABSENT', justification_statut: 'JUSTIFIEE', justification_par: 'PARENT', justification: 'Certificat médical — fièvre typhoïde' },
        { enrollment_id: eff(4), statut: 'ABSENT' },
      ] },
      { date: '2026-12-07', heure: '10:00:00', assignment: assignmentMaths, records: [
        { enrollment_id: eff(0), statut: 'ABSENT' },
      ] },
      { date: '2027-02-01', heure: '08:00:00', assignment: assignmentMaths, records: [
        { enrollment_id: eff(2), statut: 'RETARD', minutes_retard: 15 },
        { enrollment_id: eff(4), statut: 'RETARD', minutes_retard: 20 },
        { enrollment_id: eff(6), statut: 'ABSENT' },
      ] },
      { date: '2027-03-08', heure: '10:00:00', assignment: assignmentFrancais, records: [
        { enrollment_id: eff(4), statut: 'RETARD', minutes_retard: 10 },
        { enrollment_id: eff(7), statut: 'RETARD', minutes_retard: 30 },
      ] },
    ];
    for (const s of seances) {
      if (!s.assignment) continue;
      const [[existeSession]] = await conn.query(
        'SELECT id FROM attendance_sessions WHERE teacher_assignment_id = ? AND date_cours = ? AND heure_debut <=> ?',
        [s.assignment, s.date, s.heure]
      );
      let sessionId;
      if (existeSession) {
        sessionId = existeSession.id;
      } else {
        const [r] = await conn.query(
          'INSERT INTO attendance_sessions (teacher_assignment_id, timetable_slot_id, date_cours, heure_debut, created_by) VALUES (?, NULL, ?, ?, ?)',
          [s.assignment, s.date, s.heure, manifest.created.teacherUserId]
        );
        sessionId = r.insertId;
        manifest.created.sessionIds.push(sessionId);
      }
      for (const rec of s.records) {
        await conn.query(
          `INSERT INTO attendance_records (session_id, enrollment_id, statut, minutes_retard, justification, justification_statut, justification_par, justification_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE statut = VALUES(statut), minutes_retard = VALUES(minutes_retard),
             justification = VALUES(justification), justification_statut = VALUES(justification_statut),
             justification_par = VALUES(justification_par), justification_at = VALUES(justification_at)`,
          [sessionId, rec.enrollment_id, rec.statut, rec.minutes_retard ?? null, rec.justification ?? null,
           rec.justification_statut ?? 'NON_JUSTIFIEE', rec.justification_par ?? null,
           rec.justification_par ? new Date() : null]
        );
      }
    }
    console.log('✓ Absences et retards fictifs générés (avec justifications variées).');

    save();
    console.log('\n==============================================================');
    console.log('Données de démonstration prêtes (fictives).');
    console.log(`  Bulletins : connectez-vous avec un compte DIRECTEUR,`);
    console.log('  puis Bulletins → CE1 → alias « CE1 A » → Trimestre 1 ou 2.');
    console.log(`  Professeur : prof.demo@demo.example.tg / ${DEMO_PASSWORD}`);
    console.log(`  Parent     : parent.demo@demo.example.tg / ${DEMO_PASSWORD} (8 enfants)`);
    console.log(`  Comptable  : comptable.demo@demo.example.tg / ${DEMO_PASSWORD} (comptes, fiches de retard, relances, rapports)`);
    console.log('  Suppression : npm run demo:reset');
    console.log('==============================================================');
  } catch (err) {
    save(); // garde la trace de ce qui a été créé pour pouvoir nettoyer
    console.error('Échec du seed de démonstration :', err.message);
    console.error('Des données partielles ont pu être créées ; lancez npm run demo:reset pour nettoyer.');
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
