// =====================================================================
// Supprime les données de démonstration créées par scripts/seed-demo.js
// et restaure les paramètres de l'école sauvegardés.
// Lecture du manifeste .demo-manifest.json (généré à l'installation).
// =====================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MANIFEST = path.join(__dirname, '..', '.demo-manifest.json');

(async () => {
  if (!fs.existsSync(MANIFEST)) {
    console.error('Aucune installation de démonstration trouvée (.demo-manifest.json absent). Rien à supprimer.');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const c = manifest.created || {};
  const DB_NAME = process.env.DB_NAME || 'school_vie_db_004774';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: DB_NAME,
  });

  const errors = [];
  const step = async (label, fn) => {
    try { await fn(); console.log(`✓ ${label}`); }
    catch (err) { errors.push(`${label} : ${err.message}`); console.error(`✗ ${label} : ${err.message}`); }
  };
  const inClause = (ids) => ids.map(() => '?').join(',');
  const maybeDelete = async (table, ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    await conn.query(`DELETE FROM ${table} WHERE id IN (${inClause(ids)})`, ids);
  };

  try {
    if (Array.isArray(c.sessionIds) && c.sessionIds.length > 0) {
      await step('records d’appel des séances de démo supprimés', async () => {
        await conn.query(`DELETE FROM attendance_records WHERE session_id IN (${inClause(c.sessionIds)})`, c.sessionIds);
      });
      await step('séances d’appel de démo supprimées', () => maybeDelete('attendance_sessions', c.sessionIds));
    }
    await step('affectations professeur (démo) supprimées', () => maybeDelete('teacher_assignments', c.teacherAssignmentIds));
    if (Array.isArray(c.enrollmentIds) && c.enrollmentIds.length > 0) {
      await step('paiements de la démo supprimés', async () => {
        await conn.query(`DELETE FROM payments WHERE enrollment_id IN (${inClause(c.enrollmentIds)})`, c.enrollmentIds);
        // payment_allocations / payment_schedules / payment_reminders : ON DELETE CASCADE
      });
      await step('notes (grades) des élèves de démo supprimées', async () => {
        await conn.query(`DELETE FROM grades WHERE enrollment_id IN (${inClause(c.enrollmentIds)})`, c.enrollmentIds);
      });
      await step('inscriptions de démo supprimées', () => maybeDelete('enrollments', c.enrollmentIds));
    }
    await step('élèves de démo supprimés', () => maybeDelete('students', c.studentIds));
    await step('tuteur de démo supprimé', () => maybeDelete('guardians', c.guardianId ? [c.guardianId] : []));
    await step('comptes de démo supprimés', () => maybeDelete('users', [c.teacherUserId, c.parentUserId, c.comptableUserId].filter(Boolean)));
    await step('coefficients (matière × classe) créés par la démo supprimés', () => maybeDelete('class_subjects', c.classSubjects));
    await step('matières créées par la démo supprimées', () => maybeDelete('subjects', c.subjects));
    await step('trimestres de démo supprimés', () => maybeDelete('evaluation_periods', c.periodes));
    await step('alias « CE1 A » de démo supprimé', () => maybeDelete('class_aliases', c.alias ? [c.alias] : []));

    // Restauration des paramètres de l'école
    if (manifest.settingsBackup) {
      await step('paramètres de l’école restaurés', async () => {
        const s = manifest.settingsBackup;
        await conn.query(
          `UPDATE school_settings
              SET nom = ?, logo_path = ?, adresse = ?, bp = ?, ville = ?, pays = ?, telephone = ?, email = ?,
                  directeur_nom = ?, devise = ?, note_max = ?, duree_heure_minutes = ?
            WHERE id = 1`,
          [s.nom, s.logo_path, s.adresse, s.bp, s.ville, s.pays, s.telephone, s.email,
           s.directeur_nom, s.devise, s.note_max, s.duree_heure_minutes]
        );
      });
    }

    if (errors.length === 0) {
      fs.unlinkSync(MANIFEST);
      console.log('\nDonnées de démonstration entièrement supprimées. Le manifeste a été effacé.');
    } else {
      console.error(`\nTerminé avec ${errors.length} erreur(s). Le manifeste est conservé (${MANIFEST}) : corrigez puis relancez npm run demo:reset.`);
      process.exitCode = 1;
    }
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error('Échec de demo:reset :', err.message);
  process.exit(1);
});
