// =====================================================================
// SAUVEGARDES par année académique (Directeur).
// Export EN MÉMOIRE puis streamé (jamais écrit sur disque) :
//  - JSON : restauration possible ;
//  - SQL  : lecture/inspection (INSERT INTO …).
// Une trace est écrite dans backup_logs (le fichier n'est JAMAIS conservé).
// Restauration : confirmation forte côté UI (« RESTAURER »), transaction,
// journalisée. Les comptes (users), l'audit, les notifications et les
// communiqués ne sont PAS sauvegardés → la restauration les épargne.
// =====================================================================
const pool = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const yearRepo = require('../repositories/academicYearRepository');
const { log: audit } = require('../repositories/auditRepository');

// Tables à sauvegarder — dans l'ordre FK-friendly de suppression.
// (users / refresh_tokens / password_resets / audit_logs / backup_logs /
//  notifications / announcements / school_settings : exclus.)
const TABLES = [
  'attendance_records',
  'attendance_sessions',
  'timetable_slots',
  'grades',
  'payment_reminders',
  'payment_allocations',
  'payments',
  'payment_schedules',
  'teacher_assignments',
  'enrollments',
  'students',
  'guardians',
  'tuition_fee_modalities',
  'tuition_fees',
  'evaluation_periods',
  'class_subjects',
  'class_aliases',
  'classes',
  'subjects',
  'cycles',
  'academic_years',
  'sequences',
];

function serializeValeur(v) {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    const p = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
    return `'${p} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}'`;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function lireColonneInfos(tableInfo) {
  // Retourne { colonnes, lignes } pour une table.
  return { colonnes: tableInfo.colonnes, lignes: tableInfo.lignes };
}

/** Normalise les dates ISO (2026-09-01T00:00:00.000Z) en format MySQL. */
function valeurReimport(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    }
  }
  return v;
}

/** Exporte toutes les tables métier dans l'ordre, en mémoire. */
async function collecterDonnees() {
  const tables = {};
  for (const table of TABLES) {
    // eslint-disable-next-line no-await-in-loop
    const [colonnes] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
    // eslint-disable-next-line no-await-in-loop
    const [lignes] = await pool.query(`SELECT * FROM \`${table}\``);
    tables[table] = {
      colonnes: colonnes.map((c) => c.Field),
      lignes,
    };
  }
  return tables;
}

async function exporterJson(year, userId) {
  const tables = await collecterDonnees();
  const annee = await yearRepo.findById(year.id);
  const payload = {
    version: 1,
    format: 'json',
    exportedAt: new Date().toISOString(),
    academicYear: annee ? { id: annee.id, libelle: annee.libelle } : null,
    exportedBy: { userId },
    tables,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

async function exporterSql(year) {
  const tables = await collecterDonnees();
  const lignes = [];
  lignes.push('-- Sauvegarde School Vie');
  lignes.push(`-- Année académique : ${year.libelle}`);
  lignes.push(`-- Date : ${new Date().toISOString()}`);
  lignes.push('SET NAMES utf8mb4;');
  lignes.push('SET FOREIGN_KEY_CHECKS = 0;');
  for (const table of TABLES) {
    const { colonnes, lignes: rows } = tables[table];
    lignes.push('');
    lignes.push(`-- Table ${table} (${rows.length} lignes)`);
    lignes.push(`DELETE FROM \`${table}\`;`);
    for (const row of rows) {
      const valeurs = colonnes.map((c) => serializeValeur(row[c])).join(', ');
      lignes.push(`INSERT INTO \`${table}\` (\`${colonnes.join('`, `')}\`) VALUES (${valeurs});`);
    }
  }
  lignes.push('SET FOREIGN_KEY_CHECKS = 1;');
  return Buffer.from(lignes.join('\n'), 'utf8');
}

async function logBackup(academicYearId, format, taille, userId) {
  await pool.query(
    'INSERT INTO backup_logs (academic_year_id, format, taille_octets, created_by) VALUES (?, ?, ?, ?)',
    [academicYearId, format, taille, userId]
  );
}

/** Génère une sauvegarde en mémoire et la streame au client. */
async function genererEtStreamer(res, { academic_year_id, format }, userId, ip) {
  let anneeId = academic_year_id ? Number(academic_year_id) : null;
  if (!anneeId) {
    const courante = await yearRepo.findCurrent();
    anneeId = courante?.id || null;
  }
  const year = await yearRepo.findById(anneeId);
  if (!year) throw ApiError.badRequest('Année académique introuvable.', 'YEAR_NOT_FOUND');
  if (!['SQL', 'JSON'].includes(format)) {
    throw ApiError.badRequest('Format invalide (SQL ou JSON).', 'FORMAT_INVALIDE');
  }

  const buffer = format === 'SQL' ? await exporterSql(year) : await exporterJson(year, userId);
  await logBackup(anneeId, format, buffer.length, userId);
  await audit({ userId, action: 'BACKUP_CREATE', entity: 'backup_logs', entityId: anneeId, newValues: { format, taille: buffer.length }, ipAddress: ip });

  const ext = format === 'SQL' ? 'sql' : 'json';
  const safeYear = String(year.libelle).replace(/[^0-9-]/g, '');
  res.setHeader('Content-Type', format === 'SQL' ? 'application/sql; charset=utf-8' : 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="sauvegarde-${safeYear}-${format.toLowerCase()}.${ext}"`);
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

/** Liste des sauvegardes (traçabilité). */
async function listerSauvegardes() {
  const [rows] = await pool.query(
    `SELECT b.id, b.academic_year_id, b.format, b.taille_octets, b.created_at,
            ay.libelle AS annee_libelle, CONCAT(u.prenom, ' ', u.nom) AS cree_par
       FROM backup_logs b
       JOIN academic_years ay ON ay.id = b.academic_year_id
       JOIN users u ON u.id = b.created_by
      ORDER BY b.created_at DESC LIMIT 50`
  );
  return rows;
}

/**
 * Restauration contrôlée depuis un fichier JSON produit par exporterJson.
 * Remplace TOUTES les données métier (pas les comptes ni l'audit).
 * Confirmation forte nécessaire côté UI (mot « RESTAURER » + dialog).
 */
async function restaurer(bufferJson, actorId, ip) {
  let payload;
  try {
    payload = JSON.parse(bufferJson.toString('utf8'));
  } catch {
    throw ApiError.badRequest('Fichier de sauvegarde invalide : JSON illisible.', 'BACKUP_INVALID');
  }
  if (!payload || payload.version !== 1 || !payload.tables) {
    throw ApiError.badRequest('Fichier de sauvegarde invalide : structure inconnue (version attendue : 1).', 'BACKUP_INVALID');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES) {
      // eslint-disable-next-line no-await-in-loop
      await conn.query(`DELETE FROM \`${table}\``);
    }
    for (const table of [...TABLES].reverse()) {
      const data = payload.tables[table];
      if (!data || !Array.isArray(data.lignes) || data.lignes.length === 0) continue;
      const colonnes = data.colonnes || Object.keys(data.lignes[0]);
      // Insertion par lots de 200 lignes (limite de placeholders MySQL)
      const TAILLE_LOT = 200;
      for (let i = 0; i < data.lignes.length; i += TAILLE_LOT) {
        const lot = data.lignes.slice(i, i + TAILLE_LOT);
        const placeholders = `(${colonnes.map(() => '?').join(',')})`;
        // eslint-disable-next-line no-await-in-loop
        await conn.query(
          `INSERT INTO \`${table}\` (\`${colonnes.join('`, `')}\`) VALUES ${lot.map(() => placeholders).join(',')}`,
          lot.flatMap((row) => colonnes.map((c) => valeurReimport(row[c] ?? null)))
        );
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    try { await conn.query('SET FOREIGN_KEY_CHECKS = 1'); } catch { /* ignore */ }
    throw ApiError.badRequest(`Restauration impossible : ${err.message}`, 'RESTORE_FAILED');
  } finally {
    conn.release();
  }

  await audit({ userId: actorId, action: 'BACKUP_RESTORE', entity: 'backup_logs', entityId: payload.academicYear?.id || null, newValues: { academicYear: payload.academicYear?.libelle || null }, ipAddress: ip });
  return { success: true, academicYear: payload.academicYear?.libelle || null };
}

module.exports = { genererEtStreamer, listerSauvegardes, restaurer };
