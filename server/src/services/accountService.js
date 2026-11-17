// =====================================================================
// Comptes de scolarité (consultation filtrable) + relances parents +
// rapports comptables (données JSON et PDF à la volée).
// =====================================================================
const pool = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const { waLink } = require('../utils/waLink');
const { parsePagination } = require('../utils/pagination');
const paymentRepo = require('../repositories/paymentRepository');
const yearRepo = require('../repositories/academicYearRepository');
const notificationRepo = require('../repositories/notificationRepository');
const { sendMail } = require('../config/mailer');
const { mailMinimal, escapeHtml } = require('../templates/mailMinimal');
const logger = require('../utils/logger');

// Statut calculé à partir des échéances d'une inscription (sous-requêtes autonomes).
const STATUT_SQL = `
  CASE
    WHEN COALESCE((SELECT SUM(montant_paye) FROM payment_schedules WHERE enrollment_id = e.id), 0)
         >= COALESCE((SELECT SUM(montant_du) FROM payment_schedules WHERE enrollment_id = e.id), 0)
         AND EXISTS (SELECT 1 FROM payment_schedules WHERE enrollment_id = e.id) THEN 'SOLDE'
    WHEN EXISTS (
      SELECT 1 FROM payment_schedules ps2
      WHERE ps2.enrollment_id = e.id AND ps2.statut <> 'PAYE' AND ps2.date_echeance < CURDATE()
    ) THEN 'EN_RETARD'
    ELSE 'A_JOUR'
  END`;

const SELECT_COMPTE = `
  SELECT e.id AS enrollment_id, e.academic_year_id, e.class_id, e.class_alias_id, e.modalite_paiement,
         e.montant_scolarite, e.frais_inscription, e.statut AS statut_inscription,
         s.matricule, s.nom, s.prenom,
         g.nom AS tuteur_nom, g.prenom AS tuteur_prenom, g.telephone_whatsapp AS tuteur_whatsapp,
         g.email AS tuteur_email, g.user_id AS parent_user_id,
         cy.id AS cycle_id, cy.nom AS cycle_nom, cl.nom AS classe_nom, a.nom AS alias_nom,
         COALESCE((SELECT SUM(ps.montant_du) FROM payment_schedules ps WHERE ps.enrollment_id = e.id), 0) AS total_du,
         COALESCE((SELECT SUM(ps.montant_paye) FROM payment_schedules ps WHERE ps.enrollment_id = e.id), 0) AS total_paye,
         ${STATUT_SQL} AS statut_scolarite
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN guardians g ON g.id = s.guardian_id
    JOIN class_aliases a ON a.id = e.class_alias_id
    JOIN classes cl ON cl.id = e.class_id
    JOIN cycles cy ON cy.id = cl.cycle_id
`;

function appliquerFiltres(query, parametres) {
  let where = '1=1';
  if (query.academic_year_id) { parametres.push(Number(query.academic_year_id)); where += ' AND e.academic_year_id = ?'; }
  if (query.cycle_id) { parametres.push(Number(query.cycle_id)); where += ' AND cy.id = ?'; }
  if (query.class_id) { parametres.push(Number(query.class_id)); where += ' AND e.class_id = ?'; }
  if (query.class_alias_id) { parametres.push(Number(query.class_alias_id)); where += ' AND e.class_alias_id = ?'; }
  if (query.modalite_paiement) { parametres.push(query.modalite_paiement); where += ' AND e.modalite_paiement = ?'; }
  if (query.search) {
    const motif = `%${query.search}%`;
    parametres.push(motif, motif, motif);
    where += ' AND (s.nom LIKE ? OR s.prenom LIKE ? OR s.matricule LIKE ?)';
  }
  return where;
}

/** Liste paginée des comptes de scolarité avec filtre de statut (SOLDE | A_JOUR | EN_RETARD). */
async function listerComptes(query) {
  let anneeId = query.academic_year_id ? Number(query.academic_year_id) : null;
  if (!anneeId) {
    const courante = await yearRepo.findCurrent();
    anneeId = courante?.id || null;
  }
  const queryEffective = { ...query, academic_year_id: anneeId };

  const { page, parPage, offset } = parsePagination(query);
  const parametres = [];
  const where = appliquerFiltres(queryEffective, parametres);

  // Sous-requête enveloppante : le statut (calculé) est filtré APRÈS calcul pour rester cohérent.
  const sousRequete = `SELECT *, (total_du - total_paye) AS reste FROM (${SELECT_COMPTE} WHERE ${where} GROUP BY e.id) comptes`;
  const conditionStatut = query.statut ? ' AND statut_scolarite = ?' : '';
  if (query.statut) parametres.push(query.statut);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM (${sousRequete} WHERE 1=1${conditionStatut}) t`, parametres);
  const [rows] = await pool.query(
    `${sousRequete} WHERE 1=1${conditionStatut} ORDER BY nom, prenom LIMIT ? OFFSET ?`,
    [...parametres, parPage, offset]
  );

  const nettoyees = rows.map((r) => ({
    ...r,
    reste: Number(r.reste).toFixed(2),
  }));

  return { rows: nettoyees, total, page, parPage, anneeId };
}

/** Sélectionne les comptes EN RETARD / avec reste > 0 selon filtres. */
async function selectionnerEnRetard(query) {
  let anneeId = query.academic_year_id ? Number(query.academic_year_id) : null;
  if (!anneeId) {
    const courante = await yearRepo.findCurrent();
    anneeId = courante?.id || null;
  }
  const parametres = [anneeId];
  const ou = ["e.statut <> 'ANNULE'"];
  if (query.cycle_id) { parametres.push(Number(query.cycle_id)); ou.push('cy.id = ?'); }
  if (query.class_id) { parametres.push(Number(query.class_id)); ou.push('e.class_id = ?'); }
  if (query.class_alias_id) { parametres.push(Number(query.class_alias_id)); ou.push('e.class_alias_id = ?'); }
  if (query.modalite_paiement) { parametres.push(query.modalite_paiement); ou.push('e.modalite_paiement = ?'); }

  const [rows] = await pool.query(
    `${SELECT_COMPTE}
      WHERE e.academic_year_id = ? AND ${ou.join(' AND ')}
      GROUP BY e.id
     HAVING (total_du - total_paye) > 0
      ORDER BY s.nom, s.prenom`,
    parametres
  );
  return rows.map((r) => ({
    ...r,
    reste: Number((Number(r.total_du) - Number(r.total_paye)).toFixed(2)).toFixed(2),
  }));
}

/**
 * Relance les parents dont la scolarité n'est pas à jour.
 * - notification interne (si compte Parent)
 * - e-mail (si disponible, dry-run sinon)
 * - lien wa.me pré-rempli (renvoyé à l'UI pour clic manuel)
 * - historique payment_reminders (canal NOTIFICATION / EMAIL / WHATSAPP)
 */
async function relancerParents({ enrollment_ids, filtres, message }, actorId, ip) {
  let cible = [];
  if (Array.isArray(enrollment_ids) && enrollment_ids.length > 0) {
    const { rows } = await listerTousComptesParIds(enrollment_ids);
    cible = rows;
  } else if (filtres) {
    cible = await selectionnerEnRetard(filtres);
  }
  if (cible.length === 0) {
    throw ApiError.badRequest('Aucun parent à relancer pour ces critères.', 'RIEN_A_RELANCER');
  }

  const resultats = [];
  for (const ligne of cible) {
    // eslint-disable-next-line no-await-in-loop
    const resteFormate = `${Number(ligne.reste).toLocaleString('fr-FR')} FCFA`;
    const texte = (message || '').trim()
      || `Bonjour ${ligne.tuteur_prenom} ${ligne.tuteur_nom}, la scolarité de ${ligne.prenom} ${ligne.nom} (${ligne.matricule}) à l’école n’est pas à jour : reste dû de ${resteFormate} (modalité ${ligne.modalite_paiement.toLowerCase()}). Merci de régulariser rapidement.`;

    let notificationCreee = false;
    let mailEnvoye = false;
    let mailEchec = false;

    if (ligne.parent_user_id) {
      // eslint-disable-next-line no-await-in-loop
      await notificationRepo.create({
        user_id: ligne.parent_user_id,
        type: 'RELANCE',
        titre: 'Relance de scolarité',
        message: texte,
        data: { enrollmentId: ligne.enrollment_id, studentId: ligne.matricule },
      });
      notificationCreee = true;
      // eslint-disable-next-line no-await-in-loop
      await paymentRepo.insertReminder({ enrollment_id: ligne.enrollment_id, schedule_id: null, canal: 'NOTIFICATION', message: texte, statut: 'ENVOYE', sent_by: actorId });
    }

    const emailParent = ligne.tuteur_email || null;
    if (emailParent) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await sendMail({
          to: emailParent,
          subject: 'School Vie — relance de scolarité',
          html: mailMinimal(`<p style="margin:0;">${escapeHtml(texte).replace(/\n/g, '<br>')}</p>`),
        });
        mailEnvoye = true;
        // eslint-disable-next-line no-await-in-loop
        await paymentRepo.insertReminder({ enrollment_id: ligne.enrollment_id, schedule_id: null, canal: 'EMAIL', message: texte, statut: 'ENVOYE', sent_by: actorId });
      } catch (err) {
        mailEchec = true;
        logger.error('Échec de la relance par e-mail', { message: err.message, enrollmentId: ligne.enrollment_id });
        // eslint-disable-next-line no-await-in-loop
        await paymentRepo.insertReminder({ enrollment_id: ligne.enrollment_id, schedule_id: null, canal: 'EMAIL', message: texte, statut: 'ECHEC', sent_by: actorId });
      }
    }

    const wa = waLink(ligne.tuteur_whatsapp, texte);
    // eslint-disable-next-line no-await-in-loop
    await paymentRepo.insertReminder({ enrollment_id: ligne.enrollment_id, schedule_id: null, canal: 'WHATSAPP', message: texte, statut: 'ENVOYE', sent_by: actorId });

    resultats.push({
      enrollment_id: ligne.enrollment_id,
      eleve: `${ligne.prenom} ${ligne.nom}`,
      matricule: ligne.matricule,
      telephone: ligne.tuteur_whatsapp,
      email: emailParent,
      reste: ligne.reste,
      notificationCreee,
      mailEnvoye,
      mailEchec,
      waLink: wa,
    });
  }

  return {
    total: resultats.length,
    notificationsCreees: resultats.filter((r) => r.notificationCreee).length,
    mailsEnvoyes: resultats.filter((r) => r.mailEnvoye).length,
    resultats,
  };
}

/** Charge les comptes complets pour une liste d'ids (relance ciblée). */
async function listerTousComptesParIds(ids) {
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `${SELECT_COMPTE} WHERE e.id IN (${placeholders}) GROUP BY e.id`,
    ids
  );
  return {
    rows: rows.map((r) => ({
      ...r,
      reste: Number((Number(r.total_du) - Number(r.total_paye)).toFixed(2)).toFixed(2),
    })),
  };
}

/** Rapport par cycle / classe. */
async function rapportParClasse({ academic_year_id, cycle_id }) {
  let anneeId = academic_year_id ? Number(academic_year_id) : null;
  if (!anneeId) {
    const courante = await yearRepo.findCurrent();
    anneeId = courante?.id || null;
  }
  const rows = await paymentRepo.rapportParClasse({ academicYearId: anneeId, cycleId: cycle_id ? Number(cycle_id) : null });

  // Groupement par cycle + totaux
  const parCycle = new Map();
  for (const r of rows) {
    const attendu = Number(r.attendu);
    const encaisse = Number(r.encaisse);
    const reste = Math.max(0, attendu - encaisse);
    const ligne = {
      class_id: r.class_id,
      classe_nom: r.classe_nom,
      effectif: Number(r.effectif),
      attendu: attendu.toFixed(2),
      encaisse: encaisse.toFixed(2),
      reste: reste.toFixed(2),
      taux: attendu > 0 ? Math.round((encaisse / attendu) * 1000) / 10 : 0,
    };
    if (!parCycle.has(r.cycle_id)) {
      parCycle.set(r.cycle_id, { cycle_id: r.cycle_id, cycle_nom: r.cycle_nom, classes: [], attendu: 0, encaisse: 0, reste: 0, effectif: 0 });
    }
    const groupe = parCycle.get(r.cycle_id);
    groupe.classes.push(ligne);
    groupe.attendu += attendu;
    groupe.encaisse += encaisse;
    groupe.reste += reste;
    groupe.effectif += Number(r.effectif);
  }
  const cycles = [...parCycle.values()].map((g) => ({
    ...g,
    attendu: g.attendu.toFixed(2),
    encaisse: g.encaisse.toFixed(2),
    reste: g.reste.toFixed(2),
    taux: g.attendu > 0 ? Math.round((g.encaisse / g.attendu) * 1000) / 10 : 0,
  }));
  const totalAttendu = cycles.reduce((acc, c) => acc + Number(c.attendu), 0);
  const totalEncaisse = cycles.reduce((acc, c) => acc + Number(c.encaisse), 0);
  return {
    anneeId,
    cycles,
    total: {
      effectif: cycles.reduce((acc, c) => acc + c.effectif, 0),
      attendu: totalAttendu.toFixed(2),
      encaisse: totalEncaisse.toFixed(2),
      reste: (totalAttendu - totalEncaisse).toFixed(2),
      taux: totalAttendu > 0 ? Math.round((totalEncaisse / totalAttendu) * 1000) / 10 : 0,
    },
  };
}

module.exports = {
  listerComptes,
  listerTousComptesParIds,
  selectionnerEnRetard,
  relancerParents,
  rapportParClasse,
};
