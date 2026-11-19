// Communiqués : annonces de la direction ciblées (TOUS / ROLE / CYCLE / CLASSE / ALIAS).
const pool = require('../config/db');

async function createAnnouncement({ titre, contenu, auteur_id }, conn) {
  const db = conn || pool;
  const [result] = await db.query(
    'INSERT INTO announcements (titre, contenu, auteur_id) VALUES (?, ?, ?)',
    [titre, contenu, auteur_id]
  );
  return result.insertId;
}

async function addTarget(announcementId, cible, conn) {
  const db = conn || pool;
  await db.query(
    `INSERT INTO announcement_targets (announcement_id, target_type, role, cycle_id, class_id, class_alias_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      announcementId,
      cible.target_type,
      cible.role || null,
      cible.cycle_id || null,
      cible.class_id || null,
      cible.class_alias_id || null,
    ]
  );
}

/** Enrichit des lignes d'annonces avec le détail de leurs cibles (partagé listAll / listForUser). */
async function enrichirAvecCibles(rows) {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);
  const [cibles] = await pool.query(
    `SELECT t.announcement_id, t.target_type, t.role, t.cycle_id, t.class_id, t.class_alias_id,
            cy.nom AS cycle_nom, cl.nom AS classe_nom, al.nom AS alias_nom
       FROM announcement_targets t
       LEFT JOIN cycles cy ON cy.id = t.cycle_id
       LEFT JOIN classes cl ON cl.id = t.class_id
       LEFT JOIN class_aliases al ON al.id = t.class_alias_id
      WHERE t.announcement_id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  const par = new Map();
  for (const c of cibles) {
    if (!par.has(c.announcement_id)) par.set(c.announcement_id, []);
    par.get(c.announcement_id).push(c);
  }
  for (const r of rows) {
    r.cibles = par.get(r.id) || [];
    r.nb_cibles = r.cibles.length;
  }
  return rows;
}

/** Liste des communiqués avec auteur et détail des cibles (les plus récents d'abord). */
async function listAll() {
  const [rows] = await pool.query(
    `SELECT a.id, a.titre, a.contenu, a.created_at,
            u.prenom AS auteur_prenom, u.nom AS auteur_nom
       FROM announcements a JOIN users u ON u.id = a.auteur_id
      ORDER BY a.created_at DESC LIMIT 100`
  );
  return enrichirAvecCibles(rows);
}

/**
 * Communiqués « qui concernent » un utilisateur : TOUS, ceux ciblant son rôle,
 * et ceux ciblant un cycle / une classe / un alias où il enseigne (professeur)
 * ou dont ses enfants sont inscrits (parent). Les comptes de pilotage
 * (ADMIN / DIRECTEUR / SECRETAIRE) voient tout (via listAll).
 */
async function listForUser(user) {
  const me = user.id;
  const [rows] = await pool.query(
    `SELECT a.id, a.titre, a.contenu, a.created_at,
            u.prenom AS auteur_prenom, u.nom AS auteur_nom
       FROM announcements a JOIN users u ON u.id = a.auteur_id
      WHERE EXISTS (
        SELECT 1 FROM announcement_targets t
         WHERE t.announcement_id = a.id AND (
           t.target_type = 'TOUS'
           OR (t.target_type = 'ROLE' AND t.role = ?)
           OR (t.target_type = 'CYCLE' AND (
                EXISTS (SELECT 1 FROM enrollments e JOIN students s ON s.id = e.student_id JOIN guardians g ON g.id = s.guardian_id JOIN classes cl ON cl.id = e.class_id
                         WHERE cl.cycle_id = t.cycle_id AND e.statut <> 'ANNULE' AND g.user_id = ?)
                OR EXISTS (SELECT 1 FROM teacher_assignments ta JOIN class_subjects cs ON cs.id = ta.class_subject_id JOIN classes cl ON cl.id = cs.class_id
                         WHERE cl.cycle_id = t.cycle_id AND ta.teacher_id = ?)))
           OR (t.target_type = 'CLASSE' AND (
                EXISTS (SELECT 1 FROM enrollments e JOIN students s ON s.id = e.student_id JOIN guardians g ON g.id = s.guardian_id
                         WHERE e.class_id = t.class_id AND e.statut <> 'ANNULE' AND g.user_id = ?)
                OR EXISTS (SELECT 1 FROM teacher_assignments ta JOIN class_subjects cs ON cs.id = ta.class_subject_id
                         WHERE cs.class_id = t.class_id AND ta.teacher_id = ?)))
           OR (t.target_type = 'ALIAS' AND (
                EXISTS (SELECT 1 FROM enrollments e JOIN students s ON s.id = e.student_id JOIN guardians g ON g.id = s.guardian_id
                         WHERE e.class_alias_id = t.class_alias_id AND e.statut <> 'ANNULE' AND g.user_id = ?)
                OR EXISTS (SELECT 1 FROM teacher_assignments ta
                         WHERE ta.class_alias_id = t.class_alias_id AND ta.teacher_id = ?)))
         )
      )
      ORDER BY a.created_at DESC LIMIT 100`,
    [user.role, me, me, me, me, me, me]
  );
  return enrichirAvecCibles(rows);
}

/** IDs des destinataires concernés par un ensemble de cibles (dédupliqués). */
async function resolveDestinataires(cibles) {
  const ids = new Set();
  for (const cible of cibles) {
    if (cible.target_type === 'TOUS') {
      const [rows] = await pool.query('SELECT id FROM users WHERE is_active = 1');
      rows.forEach((r) => ids.add(r.id));
      continue;
    }
    if (cible.target_type === 'ROLE' && cible.role) {
      const [rows] = await pool.query('SELECT id FROM users WHERE is_active = 1 AND role = ?', [cible.role]);
      rows.forEach((r) => ids.add(r.id));
      continue;
    }
    if (cible.target_type === 'CYCLE' && cible.cycle_id) {
      // Parents des élèves inscrits dans le cycle + professeurs affectés au cycle
      const [rows] = await pool.query(
        `SELECT DISTINCT g.user_id AS id FROM enrollments e
           JOIN students s ON s.id = e.student_id
           JOIN guardians g ON g.id = s.guardian_id
           JOIN class_aliases a ON a.id = e.class_alias_id
           JOIN classes cl ON cl.id = a.class_id
          WHERE cl.cycle_id = ? AND e.statut <> 'ANNULE' AND g.user_id IS NOT NULL
         UNION
         SELECT DISTINCT ta.teacher_id AS id FROM teacher_assignments ta
           JOIN class_subjects cs ON cs.id = ta.class_subject_id
           JOIN classes cl ON cl.id = cs.class_id
          WHERE cl.cycle_id = ?`,
        [cible.cycle_id, cible.cycle_id]
      );
      rows.forEach((r) => ids.add(r.id));
      continue;
    }
    if (cible.target_type === 'CLASSE' && cible.class_id) {
      const [rows] = await pool.query(
        `SELECT DISTINCT g.user_id AS id FROM enrollments e
           JOIN students s ON s.id = e.student_id
           JOIN guardians g ON g.id = s.guardian_id
          WHERE e.class_id = ? AND e.statut <> 'ANNULE' AND g.user_id IS NOT NULL
         UNION
         SELECT DISTINCT ta.teacher_id AS id FROM teacher_assignments ta
           JOIN class_subjects cs ON cs.id = ta.class_subject_id
          WHERE cs.class_id = ?`,
        [cible.class_id, cible.class_id]
      );
      rows.forEach((r) => ids.add(r.id));
      continue;
    }
    if (cible.target_type === 'ALIAS' && cible.class_alias_id) {
      const [rows] = await pool.query(
        `SELECT DISTINCT g.user_id AS id FROM enrollments e
           JOIN students s ON s.id = e.student_id
           JOIN guardians g ON g.id = s.guardian_id
          WHERE e.class_alias_id = ? AND e.statut <> 'ANNULE' AND g.user_id IS NOT NULL
         UNION
         SELECT DISTINCT ta.teacher_id AS id FROM teacher_assignments ta
          WHERE ta.class_alias_id = ?`,
        [cible.class_alias_id, cible.class_alias_id]
      );
      rows.forEach((r) => ids.add(r.id));
    }
  }
  return [...ids];
}

module.exports = { createAnnouncement, addTarget, listAll, listForUser, resolveDestinataires };
