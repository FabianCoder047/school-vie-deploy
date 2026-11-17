// Alias de classe (CP1 A, CP1 B) — CRUD + contrôles d'usage.
const pool = require('../config/db');
const { parsePagination } = require('../utils/pagination');

async function list(query) {
  const { page, parPage, offset, search } = parsePagination(query);
  const parametres = [];
  let where = '1=1';
  if (search) {
    parametres.push(`%${search}%`);
    where += ' AND a.nom LIKE ?';
  }
  if (query.class_id) {
    parametres.push(Number(query.class_id));
    where += ' AND a.class_id = ?';
  }
  if (query.cycle_id) {
    parametres.push(Number(query.cycle_id));
    where += ' AND cl.cycle_id = ?';
  }
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM class_aliases a JOIN classes cl ON cl.id = a.class_id
      WHERE ${where}`,
    parametres
  );
  const [rows] = await pool.query(
    `SELECT a.id, a.class_id, a.nom, a.capacite, a.created_at,
            cl.nom AS classe_nom, cl.cycle_id, cy.nom AS cycle_nom
       FROM class_aliases a
       JOIN classes cl ON cl.id = a.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE ${where}
      ORDER BY cy.ordre, cl.ordre, a.nom
      LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );
  return { rows, total, page, parPage };
}

/** Liste simple (sélecteurs) : alias d'une classe donnée. */
async function listByClasse(classId) {
  const [rows] = await pool.query('SELECT id, class_id, nom FROM class_aliases WHERE class_id = ? ORDER BY nom', [classId]);
  return rows;
}

/**
 * Alias implicite d'une classe : un alias portant le nom de la classe,
 * retrouvé ou créé à la demande. Permet à une classe sans alias explicite
 * de fonctionner comme un groupe unique (inscriptions, notes, EDT, …).
 */
async function findOuCreerDefaut(classId, nomClasse) {
  const existants = await listByClasse(classId);
  const defaut = existants.find((a) => a.nom === nomClasse);
  if (defaut) return defaut;
  try {
    return await create({ class_id: classId, nom: nomClasse, capacite: null });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [[row]] = await pool.query('SELECT id, class_id, nom, capacite FROM class_aliases WHERE class_id = ? AND nom = ?', [classId, nomClasse]);
      return row || null;
    }
    throw err;
  }
}

async function findById(id) {
  const [[row]] = await pool.query('SELECT id, class_id, nom, capacite FROM class_aliases WHERE id = ?', [id]);
  return row || null;
}

async function create({ class_id, nom, capacite }) {
  const [result] = await pool.query('INSERT INTO class_aliases (class_id, nom, capacite) VALUES (?, ?, ?)', [class_id, nom, capacite ?? null]);
  return findById(result.insertId);
}

async function update(id, { nom, capacite }) {
  await pool.query('UPDATE class_aliases SET nom = ?, capacite = ? WHERE id = ?', [nom, capacite ?? null, id]);
  return findById(id);
}

async function compterUsages(id) {
  const [[{ inscriptions }]] = await pool.query('SELECT COUNT(*) AS inscriptions FROM enrollments WHERE class_alias_id = ?', [id]);
  const [[{ affectations }]] = await pool.query('SELECT COUNT(*) AS affectations FROM teacher_assignments WHERE class_alias_id = ?', [id]);
  const [[{ creneaux }]] = await pool.query('SELECT COUNT(*) AS creneaux FROM timetable_slots WHERE class_alias_id = ?', [id]);
  return { inscriptions, affectations, creneaux, total: inscriptions + affectations + creneaux };
}

async function remove(id) {
  await pool.query('DELETE FROM class_aliases WHERE id = ?', [id]);
}

module.exports = { list, listByClasse, findById, create, update, compterUsages, remove, findOuCreerDefaut };
