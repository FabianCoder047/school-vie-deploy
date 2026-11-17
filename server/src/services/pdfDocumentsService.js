// Documents PDF à la volée : reçus, fiches de retard, rapports.
// JAMAIS écrits sur disque — générés en mémoire et streamés.
const { creerDocument, finaliser, titreDocument, ligneCleValeur, encadreMontant, formatMontant } = require('../utils/pdf');
const paymentRepo = require('../repositories/paymentRepository');
const enrollmentRepo = require('../repositories/enrollmentRepository');
const scheduleRepo = require('../repositories/paymentScheduleRepository');
const settingsRepo = require('../repositories/settingsRepository');
const yearRepo = require('../repositories/academicYearRepository');
const { selectionnerEnRetard, rapportParClasse } = require('./accountService');
const { MOYENS_LIBELLE } = require('./paymentService');

function dateFr(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Reçu (inscription ou scolarité) à partir d'un paiement. */
async function genererRecu(res, payment, actorRole) {
  const fiche = await enrollmentRepo.findById(payment.enrollment_id);
  const settings = await settingsRepo.get();
  const devise = settings?.devise || 'FCFA';
  const typeLabel = payment.type === 'INSCRIPTION' ? "Reçu d'inscription" : 'Reçu de paiement de scolarité';
  const doc = await creerDocument(res, `${payment.numero_recu}.pdf`);

  titreDocument(doc, typeLabel.toUpperCase(), `N° ${payment.numero_recu} — ${dateFr(payment.date_paiement)}`);
  ligneCleValeur(doc, 'Élève', `${fiche.prenom} ${fiche.nom}`);
  ligneCleValeur(doc, 'Matricule', fiche.matricule);
  ligneCleValeur(doc, 'Classe / Alias', `${fiche.classe_nom} · ${fiche.alias_nom}`);
  ligneCleValeur(doc, 'Année académique', fiche.annee_libelle);
  ligneCleValeur(doc, 'Modalité de paiement', fiche.modalite_paiement);
  doc.moveDown(0.4);
  ligneCleValeur(doc, 'Moyen de paiement', MOYENS_LIBELLE[payment.moyen] || payment.moyen);
  if (payment.reference_transaction) {
    ligneCleValeur(doc, 'Référence de transaction', payment.reference_transaction);
  }
  ligneCleValeur(doc, 'Saisi par', `${payment.saisi_par_prenom} ${payment.saisi_par_nom}`);
  encadreMontant(doc, 'MONTANT PAYÉ', formatMontant(payment.montant, devise));

  doc.fontSize(9).fillColor('#64748b').font('Helvetica')
    .text(`En lettres : ${montantEnLettres(Number(payment.montant))} ${devise} — reçu le ${dateFr(payment.date_paiement)}.`, 40, doc.y, { width: 515 });
  doc.moveDown(2);
  doc.fillColor('#1e293b').fontSize(10).font('Helvetica');
  doc.text(`Fait à …………………, le ${dateFr(new Date())}`, 40);
  doc.moveDown(2);
  doc.text(actorRole === 'SECRETAIRE' ? 'La Secrétaire' : 'Le Comptable', 350, doc.y);
  doc.text('Signature et cachet', 350, doc.y + 4);

  finaliser(doc);
}

/** Montant en toutes lettres (français, simplifié FCFA). */
function montantEnLettres(n) {
  const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  const deux = (x) => {
    if (x < 20) return unites[x];
    const d = Math.floor(x / 10);
    const u = x % 10;
    if (d === 7 || d === 9) return `${dizaines[d]}${u === 1 && d === 7 ? '-et' : ''}${u === 0 ? '' : '-' + (d === 7 ? unites[10 + u] : unites[u])}`;
    if (u === 1 && d !== 8) return `${dizaines[d]} et un`;
    if (u === 0) return d === 8 ? 'quatre-vingts' : dizaines[d];
    return `${dizaines[d]}-${unites[u]}`;
  };
  const centaines = (x) => {
    if (x < 100) return deux(x);
    const c = Math.floor(x / 100);
    const reste = x % 100;
    const cent = c === 1 ? 'cent' : `${unites[c]} cent${reste === 0 ? 's' : ''}`;
    return reste === 0 ? cent : `${cent} ${deux(reste)}`;
  };
  const entier = Math.floor(Math.abs(n));
  if (entier === 0) return 'zéro';
  const millions = Math.floor(entier / 1_000_000);
  const milliers = Math.floor((entier % 1_000_000) / 1000);
  const reste = entier % 1000;
  const parts = [];
  if (millions) parts.push(`${millions > 1 ? `${deux(millions)} ` : ''}million${millions > 1 ? 's' : ''}`);
  if (milliers) parts.push(`${milliers > 1 ? `${deux(milliers)} ` : ''}mille`);
  if (reste) parts.push(centaines(reste));
  return parts.join(' ');
}

/** Fiches de retard groupées (une par élève) selon filtres + modalité. */
async function genererFichesRetard(res, filtres, actorNom) {
  const lignes = (await selectionnerEnRetard(filtres))
    .filter((l) => !filtres.modalite_paiement || l.modalite_paiement === filtres.modalite_paiement);

  const settings = await settingsRepo.get();
  const devise = settings?.devise || 'FCFA';
  const doc = await creerDocument(res, 'fiches-retard.pdf');

  if (lignes.length === 0) {
    titreDocument(doc, 'FICHES DE RETARD', 'Aucun retard pour ces critères.');
    doc.fontSize(10).text('Aucun élève ne correspond aux filtres choisis.');
    finaliser(doc);
    return;
  }

  const dateDuJour = new Date().toISOString().slice(0, 10);
  let premiere = true;
  for (const ligne of lignes) {
    if (!premiere) doc.addPage();
    premiere = false;

    const echeances = (await scheduleRepo.listByEnrollment(ligne.enrollment_id))
      .filter((e) => e.statut !== 'PAYE' && String(e.date_echeance).slice(0, 10) < dateDuJour);

    titreDocument(doc, 'FICHE DE RETARD DE PAIEMENT', `Modalité : ${ligne.modalite_paiement}`);
    ligneCleValeur(doc, 'Élève', `${ligne.prenom} ${ligne.nom}`);
    ligneCleValeur(doc, 'Matricule', ligne.matricule);
    ligneCleValeur(doc, 'Classe / Alias', `${ligne.classe_nom} · ${ligne.alias_nom}`);
    ligneCleValeur(doc, 'Tuteur', `${ligne.tuteur_prenom} ${ligne.tuteur_nom} — ${ligne.tuteur_whatsapp}`);
    doc.moveDown(0.4);

    doc.fontSize(9.5).fillColor('#1e293b').font('Helvetica-Bold').text('Échéances en retard :');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9).fillColor('#334155');
    let totalRetard = 0;
    for (const e of echeances) {
      const resteEcheance = Number(e.montant_du) - Number(e.montant_paye);
      totalRetard += resteEcheance;
      doc.text(`N° ${e.numero} — échéance du ${new Date(e.date_echeance).toLocaleDateString('fr-FR')} : ${formatMontant(resteEcheance, devise)} (payé : ${formatMontant(e.montant_paye, devise)} / ${formatMontant(e.montant_du, devise)})`);
    }
    doc.moveDown(0.6);
    encadreMontant(doc, 'TOTAL DÛ EN RETARD', formatMontant(totalRetard, devise));
    doc.fontSize(9).fillColor('#64748b').font('Helvetica')
      .text(`Arrêtée le ${dateFr(new Date())}. Merci de régulariser dans les meilleurs délais.`, 40, doc.y, { width: 515 });
    doc.moveDown(1.5);
    doc.text('La Direction', 380, doc.y);
  }

  finaliser(doc);
}

/** Rapport comptable (cycle/classe) en PDF. */
async function genererRapportPdf(res, { academic_year_id, cycle_id }, actorNom) {
  const rapport = await rapportParClasse({ academic_year_id, cycle_id });
  const settings = await settingsRepo.get();
  const devise = settings?.devise || 'FCFA';
  const annee = rapport.anneeId ? await yearRepo.findById(rapport.anneeId) : null;

  const doc = await creerDocument(res, 'rapport-comptable.pdf');
  titreDocument(doc, 'RAPPORT COMPTABLE', `Année académique ${annee?.libelle || '—'} — généré le ${dateFr(new Date())} par ${actorNom}`);

  const dessinTableau = (entetes, lignes, largeurs, estTotal = false) => {
    const x0 = 40;
    let y = doc.y;
    // En-tête
    let x = x0;
    doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica-Bold');
    doc.rect(x0, y, largeurs.reduce((a, b) => a + b, 0), 20).fill('#1d4ed8');
    entetes.forEach((h, i) => {
      doc.fillColor('#ffffff').text(h, x + 4, y + 6, { width: largeurs[i] - 8 });
      x += largeurs[i];
    });
    y += 20;
    doc.font('Helvetica').fontSize(8.5);
    lignes.forEach((ligne, index) => {
      x = x0;
      if (y > 740) { doc.addPage(); y = 60; }
      doc.rect(x0, y, largeurs.reduce((a, b) => a + b, 0), 18).fill(index % 2 === 0 || estTotal ? '#f8fafc' : '#ffffff');
      ligne.forEach((cellule, i) => {
        doc.fillColor('#1e293b').text(String(cellule), x + 4, y + 5, { width: largeurs[i] - 8 });
        x += largeurs[i];
      });
      y += 18;
    });
    doc.y = y + 8;
  };

  const largeurs = [150, 55, 105, 105, 100, 70];
  for (const cycle of rapport.cycles) {
    doc.fontSize(11).fillColor('#1e40af').font('Helvetica-Bold').text(`Cycle ${cycle.cycle_nom}`, 40, doc.y);
    doc.moveDown(0.3);
    dessinTableau(
      ['Classe', 'Effectif', 'Attendu', 'Encaissé', 'Reste', 'Recouvr.'],
      cycle.classes.map((c) => [c.classe_nom, c.effectif, formatMontant(c.attendu, devise), formatMontant(c.encaisse, devise), formatMontant(c.reste, devise), `${c.taux} %`]),
      largeurs
    );
    doc.fontSize(8.5).fillColor('#334155').font('Helvetica-Oblique')
      .text(`Sous-total ${cycle.cycle_nom} : attendu ${formatMontant(cycle.attendu, devise)} — encaissé ${formatMontant(cycle.encaisse, devise)} — reste ${formatMontant(cycle.reste, devise)} — recouvrement ${cycle.taux} %`, 40, doc.y);
    doc.moveDown(0.8);
  }

  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#1e3a8a').font('Helvetica-Bold')
    .text(`TOTAL ÉCOLE : ${rapport.total.effectif} élève(s) — attendu ${formatMontant(rapport.total.attendu, devise)} — encaissé ${formatMontant(rapport.total.encaisse, devise)} — reste ${formatMontant(rapport.total.reste, devise)} — recouvrement ${rapport.total.taux} %`, 40, doc.y, { width: 515 });

  finaliser(doc);
}

module.exports = { genererRecu, genererFichesRetard, genererRapportPdf, montantEnLettres, dateFr };
