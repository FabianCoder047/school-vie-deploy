// =====================================================================
// LISTE DE RENVOI (Comptable) — classe entière, échéances arrêtées à une date.
//
// Rappel : l'application ne connaît pas de notion de « tranche ». Le comptable
// choisit la classe et la DATE D'ARRÊT ; la liste reprend TOUS les élèves de la
// classe avec, pour chacun :
//   - « Payé sur le dû »   : versements affectés aux échéances dues à la date d'arrêt
//   - « Reste dû »         : échéances dues à la date d'arrêt non couvertes
//   - « Total à régler »   : reste dû à la date d'arrêt (arriérés inclus) — c'est
//                            la somme à verser pour être à jour à cette date
//   - « Total payé »       : ensemble des versements scolarité valides
//   - « Reste écolage »    : écolage complet (figé à l'inscription) − total payé
//   - « Dernier versement »: date du dernier paiement valide (tous types)
// Les élèves ne réglant pas le dû à la date d'arrêt sont « à renvoyer »
// (lignes teintées dans le PDF ; colonne Statut dans l'aperçu).
// =====================================================================
const pool = require('../config/db');
const settingsRepo = require('../repositories/settingsRepository');
const yearRepo = require('../repositories/academicYearRepository');
const { ApiError } = require('../utils/ApiError');
const { log: audit } = require('../repositories/auditRepository');
const { creerDocument, finaliser, BLEU, GRIS, GRIS_FONCE } = require('../utils/pdf');
const { ymd } = require('../utils/dates');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateFr(d) {
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Données de la liste (partagé JSON / PDF). */
async function calculerListe({ classId, au }) {
  if (!Number.isInteger(classId) || classId <= 0) {
    throw ApiError.badRequest('La classe est requise.', 'CLASSE_REQUISE');
  }
  const dateArret = au && DATE_RE.test(String(au)) ? String(au).slice(0, 10) : ymd(new Date());

  const annee = await yearRepo.findCurrent();
  if (!annee) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');

  const [[classe]] = await pool.query(
    `SELECT cl.id, cl.nom, cy.nom AS cycle_nom
       FROM classes cl JOIN cycles cy ON cy.id = cl.cycle_id WHERE cl.id = ?`,
    [classId]
  );
  if (!classe) throw ApiError.notFound('Classe introuvable.', 'CLASSE_INTROUVABLE');

  const [[frais]] = await pool.query(
    'SELECT montant_scolarite FROM tuition_fees WHERE academic_year_id = ? AND class_id = ?',
    [annee.id, classId]
  );

  const [enrollments] = await pool.query(
    `SELECT e.id, e.statut, e.montant_scolarite,
            s.matricule, s.nom, s.prenom
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
      WHERE e.class_id = ? AND e.academic_year_id = ? AND e.statut <> 'ANNULE'
      ORDER BY s.nom, s.prenom`,
    [classId, annee.id]
  );
  const ids = enrollments.map((e) => e.id);

  let parEnrollment = new Map();
  let dernierVersement = new Map();
  if (ids.length > 0) {
    const marqueurs = ids.map(() => '?').join(',');
    const [sommes] = await pool.query(
      `SELECT enrollment_id,
              COALESCE(SUM(CASE WHEN date_echeance <= ? THEN montant_du END), 0)    AS du_au,
              COALESCE(SUM(CASE WHEN date_echeance <= ? THEN montant_paye END), 0) AS paye_au,
              COALESCE(SUM(montant_paye), 0)                                        AS total_paye
         FROM payment_schedules
        WHERE enrollment_id IN (${marqueurs})
        GROUP BY enrollment_id`,
      [dateArret, dateArret, ...ids]
    );
    parEnrollment = new Map(sommes.map((r) => [r.enrollment_id, r]));

    const [paiements] = await pool.query(
      `SELECT enrollment_id, MAX(date_paiement) AS dernier
         FROM payments
        WHERE enrollment_id IN (${marqueurs}) AND statut = 'VALIDE'
        GROUP BY enrollment_id`,
      ids
    );
    dernierVersement = new Map(paiements.map((r) => [r.enrollment_id, r.dernier]));
  }

  const lignes = enrollments.map((e) => {
    const s = parEnrollment.get(e.id) || { du_au: 0, paye_au: 0, total_paye: 0 };
    const duAu = Number(s.du_au);
    const payeAu = Number(s.paye_au);
    const totalPaye = Number(s.total_paye);
    const resteDu = Math.max(0, Number((duAu - payeAu).toFixed(2)));
    const resteEcolage = Math.max(0, Number((Number(e.montant_scolarite) - totalPaye).toFixed(2)));
    return {
      enrollment_id: e.id,
      matricule: e.matricule,
      nom: e.nom,
      prenom: e.prenom,
      statut_inscription: e.statut,
      paye_sur_le_du: Number(payeAu.toFixed(2)),
      reste_du: resteDu,
      total_a_regler: resteDu,
      total_paye: Number(totalPaye.toFixed(2)),
      reste_ecolage: resteEcolage,
      scolarite: Number(e.montant_scolarite),
      dernier_versement: dernierVersement.get(e.id) || null,
      statut: resteDu <= 0 ? 'A_JOUR' : 'A_RENVOYER',
    };
  });

  // Écolage complet affiché : frais de la classe si configurés, sinon montant(s)
  // figé(s) à l'inscription (un seul → affiché ; plusieurs → « variable »).
  let ecolageComplet = frais ? Number(frais.montant_scolarite) : null;
  let ecolageVariable = false;
  if (ecolageComplet == null) {
    const uniques = [...new Set(lignes.map((l) => l.scolarite))];
    if (uniques.length === 1) ecolageComplet = uniques[0];
    else if (uniques.length > 1) ecolageVariable = true;
  }

  const totaux = lignes.reduce(
    (acc, l) => ({
      paye_sur_le_du: acc.paye_sur_le_du + l.paye_sur_le_du,
      reste_du: acc.reste_du + l.reste_du,
      total_a_regler: acc.total_a_regler + l.total_a_regler,
      total_paye: acc.total_paye + l.total_paye,
      reste_ecolage: acc.reste_ecolage + l.reste_ecolage,
    }),
    { paye_sur_le_du: 0, reste_du: 0, total_a_regler: 0, total_paye: 0, reste_ecolage: 0 }
  );
  for (const k of Object.keys(totaux)) totaux[k] = Number(totaux[k].toFixed(2));

  const aJour = lignes.filter((l) => l.statut === 'A_JOUR').length;
  const today = ymd(new Date());

  return {
    classe: { id: classe.id, nom: classe.nom, cycle_nom: classe.cycle_nom },
    annee: { id: annee.id, libelle: annee.libelle },
    ecolage_complet: ecolageComplet,
    ecolage_variable: ecolageVariable,
    au: dateArret,
    edite_le: today,
    effectif: lignes.length,
    a_jour: aJour,
    a_renvoyer: lignes.length - aJour,
    previsionnelle: dateArret > today,
    devise: (await settingsRepo.get())?.devise || 'FCFA',
    lignes,
    totaux,
  };
}

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Montants au format français SANS espaces insécables (absentes de la police
// Helvetica des PDF) : milliers séparés par des espaces simples, virgule décimale.
function fmtNum(n) {
  const v = Number(n || 0);
  const neg = v < 0;
  const [entier, dec = '00'] = Math.abs(v).toFixed(2).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const out = dec === '00' ? groupe : `${groupe},${dec}`;
  return neg ? `-${out}` : out;
}
const fmtCell = (n) => fmtNum(n);
const fmtMontantLocal = (n, devise) => `${fmtNum(n)} ${devise}`;

/** Génère le PDF de la liste (streamé, jamais écrit sur disque). */
async function genererListeRenvoiPdf(res, { classId, au, actorId, actorRole, ip }) {
  const liste = await calculerListe({ classId, au });
  const devise = liste.devise;
  const doc = await creerDocument(res, `liste-de-renvoi-${slug(liste.classe.nom)}-au-${liste.au}.pdf`);

  await audit({
    userId: actorId,
    action: 'LISTE_RENVOI',
    entity: 'liste_renvoi',
    entityId: liste.classe.id,
    newValues: { class_id: liste.classe.id, au: liste.au, effectif: liste.effectif, a_renvoyer: liste.a_renvoyer, role: actorRole || null },
    ipAddress: ip,
  });

  /* ===== Bandeau titre ===== */
  doc.font('Helvetica-Bold').fontSize(19).fillColor(GRIS_FONCE).text('LISTE DE RENVOI', 40, doc.y);
  doc.fontSize(12).fillColor(BLEU).text(`${liste.classe.nom} — au ${dateFr(liste.au)}`, 40, doc.y + 2);
  doc.font('Helvetica').fontSize(9).fillColor(GRIS)
    .text(
      `Niveau : ${liste.classe.nom} — Année scolaire : ${liste.annee.libelle} — Écolage complet : ${liste.ecolage_complet != null ? fmtMontantLocal(liste.ecolage_complet, devise) : liste.ecolage_variable ? 'variable (selon les élèves)' : '—'}`,
      40, doc.y + 4
    )
    .text(
      `Échéances arrêtées au : ${dateFr(liste.au)} — Effectif : ${liste.effectif} — À jour : ${liste.a_jour} — À renvoyer : ${liste.a_renvoyer} — Édité le ${dateFr(liste.edite_le)}`,
      40, doc.y + 3
    );
  doc.moveDown(0.8);

  if (liste.previsionnelle) {
    const y = doc.y;
    doc.roundedRect(40, y, 515, 22, 4).lineWidth(1).strokeColor('#f59e0b').fill('#fffbeb').stroke();
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#92400e')
      .text('La date d’arrêt n’est pas encore atteinte : cette liste est prévisionnelle.', 48, y + 7);
    doc.y = y + 30;
  }

  /* ===== Tableau ===== */
  const entetes = ['N°', 'Matricule', 'Nom & Prénom', 'Payé sur le dû', 'Reste dû', 'TOTAL À RÉGLER', 'Total payé', 'Reste écolage', 'Dernier vers.'];
  const largeurs = [20, 74, 102, 52, 52, 60, 52, 55, 48]; // = 515
  const x0 = 40;
  let y = doc.y;

  const dessinerEntete = () => {
    let x = x0;
    doc.rect(x0, y, largeurs.reduce((a, b) => a + b, 0), 18).fill(BLEU);
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#ffffff');
    entetes.forEach((h, i) => {
      doc.text(h, x + 3, y + 5, { width: largeurs[i] - 6 });
      x += largeurs[i];
    });
    y += 18;
  };
  dessinerEntete();

  const hauteurLigne = 16;
  doc.font('Helvetica').fontSize(7);
  liste.lignes.forEach((l, index) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
      dessinerEntete();
      doc.font('Helvetica').fontSize(7);
    }
    const aRenvoyer = l.statut === 'A_RENVOYER';
    let x = x0;
    doc.rect(x0, y, largeurs.reduce((a, b) => a + b, 0), hauteurLigne)
      .fill(aRenvoyer ? '#fef2f2' : index % 2 === 0 ? '#f8fafc' : '#ffffff');
    const cellules = [
      String(index + 1),
      l.matricule,
      `${l.nom} ${l.prenom}`,
      fmtCell(l.paye_sur_le_du),
      fmtCell(l.reste_du),
      fmtCell(l.total_a_regler),
      fmtCell(l.total_paye),
      fmtCell(l.reste_ecolage),
      l.dernier_versement ? new Date(l.dernier_versement).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '—',
    ];
    cellules.forEach((c, i) => {
      const align = i >= 3 && i <= 7 ? 'right' : i === 0 ? 'center' : 'left';
      doc.fillColor(aRenvoyer && i === 5 ? '#b91c1c' : GRIS_FONCE)
        .font(i === 5 || i === 4 ? 'Helvetica-Bold' : 'Helvetica')
        .text(c, x + 3, y + 4, { width: largeurs[i] - 6, align });
      x += largeurs[i];
    });
    y += hauteurLigne;
  });

  /* ===== Ligne de totaux ===== */
  if (y > 700) { doc.addPage(); y = 50; }
  let x = x0;
  doc.rect(x0, y, largeurs.reduce((a, b) => a + b, 0), 18).fill('#e2e8f0');
  const cellulesTotal = [
    '', '', `Total (${liste.lignes.length} élève${liste.lignes.length > 1 ? 's' : ''})`,
    fmtCell(liste.totaux.paye_sur_le_du), fmtCell(liste.totaux.reste_du), fmtCell(liste.totaux.total_a_regler),
    fmtCell(liste.totaux.total_paye), fmtCell(liste.totaux.reste_ecolage), '',
  ];
  cellulesTotal.forEach((c, i) => {
    const align = i >= 3 && i <= 7 ? 'right' : 'left';
    doc.font('Helvetica-Bold').fontSize(7).fillColor(GRIS_FONCE).text(c, x + 3, y + 5, { width: largeurs[i] - 6, align });
    x += largeurs[i];
  });
  doc.y = y + 26;

  /* ===== Notes + légende ===== */
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(GRIS)
    .text('Versements appliqués par ordre d’échéance. « Total à régler » = échéances dues à la date d’arrêt non couvertes (arriérés inclus) : c’est la somme à verser pour être à jour à cette date.', 40, doc.y, { width: 515 })
    .text('Les lignes sur fond rouge sont les élèves à renvoyer (échéances dues non réglées à la date d’arrêt).', 40, doc.y + 3, { width: 515 });
  doc.moveDown(2.2);

  /* ===== Signatures ===== */
  const ySign = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GRIS_FONCE);
  doc.text('LE COMPTABLE', 40, ySign, { width: 240, align: 'center' });
  doc.text('LE DIRECTEUR', 320, ySign, { width: 235, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(GRIS);
  doc.text('Signature', 40, ySign + 46, { width: 240, align: 'center' });
  doc.text('Signature', 320, ySign + 46, { width: 235, align: 'center' });

  finaliser(doc);
}

module.exports = { calculerListe, genererListeRenvoiPdf };
