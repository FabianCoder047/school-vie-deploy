// =====================================================================
// FICHES DE PROCLAMATION — une fiche A4 par alias, PDF généré en mémoire
// (pdfkit) et streamé au client, jamais écrit sur disque.
//
// Contenu : en-tête officiel (République Togolaise + école), période,
// année scolaire, statistiques de la classe, puis le tableau des élèves
// classés par rang avec leur moyenne générale et la décision calculée
// (ADMIS si moyenne >= 10/20, REDOUBLE sinon). Visa du Chef d'établissement.
//
// Les données (notes, moyennes, rangs, effectif) viennent du service PARTAGÉ
// classesDataService, déjà utilisé par les bulletins et l'espace Parent.
// =====================================================================
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const settingsRepo = require('../repositories/settingsRepository');
const { collecterDonneesAlias } = require('./classesDataService');
const { formatRang } = require('../utils/rang');

const BLEU = '#1e40af';
const BLEU_SOMBRE = '#16255f';
const JAUNE = '#eab308';
const VERT = '#15803d';
const ROUGE = '#b91c1c';
const GRIS = '#475569';
const GRIS_FONCE = '#0f172a';
const GRIS_CLAIR = '#94a3b8';
const BORDURE = '#cbd5e1';

const W = 595.28;
const MARGE = 40;
const LARGEUR = W - 2 * MARGE;
const HAUT_LIGNE = 19;
const BAS_TABLEAU = 714;
const PIED_PAGE = 822;

/** Chemin disque d'une image uploadée (ou null) — même règle que les bulletins. */
function cheminUpload(url) {
  if (!url || !String(url).startsWith('/uploads/')) return null;
  const segments = String(url).split('/').filter((s) => s && s !== '.' && s !== '..');
  const disque = path.join(__dirname, '..', '..', ...segments);
  return fs.existsSync(disque) ? disque : null;
}

function dateFr(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function noteFr(v) {
  return v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(2).replace('.', ',');
}

/** Décision indicative : la moyenne généralise le conseil de classe (souverain). */
function decisionProclamation(moyenne) {
  const m = moyenne == null ? null : Number(moyenne);
  if (m === null || !Number.isFinite(m)) return { libelle: '—', admis: false, evalue: false };
  const admis = m >= 10;
  return { libelle: admis ? 'ADMIS' : 'REDOUBLE', admis, evalue: true };
}

/** Classement : rangs croissants (ex æquo déjà gérés en amont), non classés en fin. */
function trierParRang(eleves) {
  return [...eleves].sort((a, b) => {
    const ra = a.rang == null ? Infinity : Number(a.rang);
    const rb = b.rang == null ? Infinity : Number(b.rang);
    if (ra !== rb) return ra - rb;
    return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr')
      || String(a.prenom || '').localeCompare(String(b.prenom || ''), 'fr');
  });
}

const LARGEUR_DECISION = 116;
const COLONNES = [
  { titre: 'Rang', largeur: 46, align: 'center' },
  { titre: 'Nom et prénoms', largeur: LARGEUR - 46 - 76 - LARGEUR_DECISION, align: 'left' },
  { titre: 'Moyenne /20', largeur: 76, align: 'center' },
  { titre: 'Décision', largeur: LARGEUR_DECISION, align: 'center' },
];

/** En-tête officiel complet (première page) — retourne l'ordonnée du tableau. */
function enTeteComplet(doc, { ecole, logoPath, aliasInfo, periode, annee, stats }) {
  const topY = 22;
  const leftX = MARGE;
  const leftW = 265;
  const rightX = 335;
  const rightW = W - MARGE - rightX;

  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(13)
    .text('RÉPUBLIQUE TOGOLAISE', leftX, topY, { width: leftW, characterSpacing: 1 });
  doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
    .text('Travail – Liberté – Patrie', leftX, doc.y + 1, { width: leftW });
  doc.moveTo(leftX, doc.y + 4).lineTo(leftX + 92, doc.y + 4).lineWidth(1.6).strokeColor(JAUNE).stroke();
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(8.4)
    .text('Ministère de l’Éducation Nationale', leftX, doc.y + 8, { width: leftW });
  const basGauche = doc.y;

  let ry = topY;
  if (logoPath) {
    try { doc.image(logoPath, rightX + (rightW - 46) / 2, ry, { height: 46 }); ry += 49; } catch { /* ignore */ }
  }
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(10)
    .text(String(ecole?.nom || 'École').toUpperCase(), rightX, ry, { width: rightW, align: 'center' });
  const contact = [
    ecole?.bp ? `BP ${ecole.bp}` : null,
    ecole?.ville || null,
    ecole?.pays || null,
    ecole?.telephone ? `Tél : ${ecole.telephone}` : null,
    ecole?.email || null,
  ].filter(Boolean).join('  ·  ');
  if (contact) {
    doc.fillColor(GRIS).font('Helvetica').fontSize(6.3)
      .text(contact, rightX, doc.y + 1, { width: rightW, align: 'center' });
  }
  const bas = Math.max(basGauche, doc.y);
  doc.moveTo(315, topY - 2).lineTo(315, bas + 2).lineWidth(0.5).strokeColor(BORDURE).stroke();
  const ruleY = bas + 10;
  doc.moveTo(MARGE, ruleY).lineTo(W - MARGE, ruleY).lineWidth(2.1).strokeColor(GRIS_FONCE).stroke();
  doc.moveTo(MARGE, ruleY + 3.4).lineTo(W - MARGE, ruleY + 3.4).lineWidth(0.7).strokeColor(GRIS_FONCE).stroke();

  // Titre et contexte
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(16)
    .text('FICHE DE PROCLAMATION', 0, ruleY + 11, { width: W, align: 'center', characterSpacing: 0.6 });
  doc.fillColor(BLEU_SOMBRE).font('Helvetica-Bold').fontSize(9)
    .text(`${aliasInfo.alias_nom}  ·  ${periode.libelle}  ·  Année scolaire ${annee?.libelle || ''}`, 0, doc.y + 3, { width: W, align: 'center' });
  doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
    .text(`${aliasInfo.classe_nom} — ${aliasInfo.cycle_nom}`, 0, doc.y + 2, { width: W, align: 'center' });

  // Bandeau statistiques
  const statsY = doc.y + 9;
  const cellules = [
    ['EFFECTIF', String(stats.effectif)],
    ['MOYENNE DE LA CLASSE', noteFr(stats.moyenneClasse)],
    ['ADMIS (≥ 10/20)', String(stats.nbAdmis)],
    ['TAUX DE RÉUSSITE', `${String(stats.pctReussite).replace('.', ',')} %`],
  ];
  const ecart = 4;
  const cellW = (LARGEUR - 3 * ecart) / 4;
  cellules.forEach(([label, valeur], i) => {
    const cx = MARGE + i * (cellW + ecart);
    doc.roundedRect(cx, statsY, cellW, 38, 3).fill(i === 1 ? BLEU_SOMBRE : '#f1f5f9');
    const clair = i === 1;
    doc.fillColor(clair ? '#bfdbfe' : GRIS).font('Helvetica-Bold').fontSize(6.6)
      .text(label, cx + 4, statsY + 7, { width: cellW - 8, align: 'center', characterSpacing: 0.2 });
    doc.fillColor(clair ? JAUNE : GRIS_FONCE).font('Helvetica-Bold').fontSize(12)
      .text(valeur, cx + 4, statsY + 19, { width: cellW - 8, align: 'center' });
  });

  return enteteTableau(doc, statsY + 46);
}

/** En-tête réduit pour les pages de suite. */
function enTeteSuite(doc, { ecole, aliasInfo, periode }) {
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(9)
    .text(String(ecole?.nom || 'École').toUpperCase(), MARGE, 20, { width: LARGEUR, lineBreak: false });
  doc.fillColor(GRIS).font('Helvetica').fontSize(7)
    .text(`Fiche de proclamation — ${aliasInfo.alias_nom} · ${periode.libelle} (suite)`, MARGE, 34, { width: LARGEUR, lineBreak: false });
  doc.moveTo(MARGE, 47).lineTo(W - MARGE, 47).lineWidth(1.2).strokeColor(GRIS_FONCE).stroke();
  return enteteTableau(doc, 53);
}

function enteteTableau(doc, y) {
  doc.roundedRect(MARGE, y, LARGEUR, 20, 3).fill(BLEU);
  let x = MARGE;
  for (const col of COLONNES) {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7)
      .text(col.titre.toUpperCase(), x + 4, y + 6, { width: col.largeur - 8, align: col.align, characterSpacing: 0.3 });
    x += col.largeur;
  }
  return y + 20;
}

function dessinerLigne(doc, y, eleve, index) {
  const decision = decisionProclamation(eleve.moyenneGenerale);
  if (index % 2 === 0) doc.rect(MARGE, y, LARGEUR, HAUT_LIGNE).fill('#f8fafc');
  const nom = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim().toUpperCase() || '—';
  const cellules = [
    { valeur: formatRang(eleve.rang), gras: true, couleur: GRIS_FONCE },
    { valeur: nom, gras: true, couleur: GRIS_FONCE },
    { valeur: noteFr(eleve.moyenneGenerale), gras: true, couleur: !decision.evalue ? GRIS_CLAIR : decision.admis ? VERT : ROUGE },
    { valeur: decision.libelle, gras: true, couleur: !decision.evalue ? GRIS_CLAIR : decision.admis ? VERT : ROUGE },
  ];
  let x = MARGE;
  cellules.forEach((cellule, i) => {
    const col = COLONNES[i];
    const taille = i === 1 && cellule.valeur.length > 38 ? 6.6 : 8;
    doc.fillColor(cellule.couleur).font(cellule.gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(taille)
      .text(cellule.valeur, x + 4, y + HAUT_LIGNE / 2 - taille / 2 - 1, {
        width: col.largeur - 8, align: col.align, ellipsis: true, lineBreak: false,
      });
    x += col.largeur;
  });
  doc.moveTo(MARGE, y + HAUT_LIGNE).lineTo(W - MARGE, y + HAUT_LIGNE).lineWidth(0.25).strokeColor('#e2e8f0').stroke();
}

/** Visa du Chef d'établissement (dessiné sur la dernière page). */
function dessinerVisa(doc, ecole, signaturePath) {
  const y = 733;
  const h = 66;
  doc.roundedRect(MARGE, y, LARGEUR, h, 3).lineWidth(0.9).strokeColor(BORDURE).stroke();
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(7.5)
    .text('VISA DU CHEF D’ÉTABLISSEMENT', MARGE + 10, y + 7, { characterSpacing: 0.4 });
  doc.fillColor(GRIS).font('Helvetica').fontSize(7.3)
    .text(`Fait à ${ecole?.ville || 'Lomé'}, le ${dateFr(new Date())}`, MARGE + 10, y + 20, { lineBreak: false });

  const sigW = 110;
  const sigX = W - MARGE - 14 - sigW;
  const lineY = y + h - 18;
  if (signaturePath) {
    try { doc.image(signaturePath, sigX, lineY - 17, { fit: [sigW, 15], align: 'center', valign: 'bottom' }); }
    catch { /* ignore */ }
  }
  doc.moveTo(sigX, lineY).lineTo(sigX + sigW, lineY).lineWidth(0.8).strokeColor(GRIS_FONCE).stroke();
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(7)
    .text(ecole?.directeur_nom?.trim() || 'Le Chef d’établissement', sigX, lineY + 3, { width: sigW, align: 'center', lineBreak: false });

  doc.fillColor(GRIS_CLAIR).font('Helvetica-Oblique').fontSize(6.2)
    .text('Décision calculée sur la moyenne de la période à titre indicatif ; le conseil de classe reste souverain.',
      MARGE + 10, y + h - 15, { width: LARGEUR - sigW - 40, lineBreak: false });
}

function dessinerPied(doc, page, total, ecole) {
  doc.fillColor(GRIS_CLAIR).font('Helvetica').fontSize(6.5)
    .text(`Édité le ${dateFr(new Date())} — ${ecole?.nom || ''}`, MARGE, PIED_PAGE, { width: LARGEUR, align: 'left', lineBreak: false });
  doc.fillColor(GRIS).font('Helvetica').fontSize(6.5)
    .text(`Page ${page} / ${total}`, MARGE, PIED_PAGE, { width: LARGEUR, align: 'right', lineBreak: false });
}

/** Génère le PDF en mémoire et le streame au client (une fiche par alias). */
async function genererFicheProclamation(res, { academicYearId, classAliasId, periodeId }) {
  const donnees = await collecterDonneesAlias({ academicYearId, classAliasId, periodeId });
  const ecole = (await settingsRepo.get()) || {};
  const logoPath = cheminUpload(ecole.logo_path);
  const signaturePath = cheminUpload(ecole.signature_path);

  const titreFichier = `fiche-proclamation-${String(donnees.aliasInfo.alias_nom || 'classe').replace(/\s+/g, '-')}`;
  const doc = new PDFDocument({
    size: 'A4', margin: 0, autoFirstPage: false, bufferPages: true,
    info: { Title: titreFichier, Author: 'School Vie' },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${titreFichier}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);

  const contexte = { ecole, aliasInfo: donnees.aliasInfo, periode: donnees.periode, annee: donnees.annee };
  const stats = { ...donnees.statsClasse, effectif: donnees.effectif };

  doc.addPage();
  let y = enTeteComplet(doc, { ...contexte, stats });

  const eleves = trierParRang(donnees.eleves);
  if (eleves.length === 0) {
    doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(11)
      .text('Aucun élève inscrit dans cet alias pour l’année scolaire en cours.', MARGE, y + 30, { width: LARGEUR, align: 'center' });
  } else {
    eleves.forEach((eleve, index) => {
      if (y + HAUT_LIGNE > BAS_TABLEAU) {
        doc.addPage();
        y = enTeteSuite(doc, contexte);
      }
      dessinerLigne(doc, y, eleve, index);
      y += HAUT_LIGNE;
    });
  }

  // Pied de page et visa ajoutés après coup (pdfkit permet de revenir sur une page).
  const plage = doc.bufferedPageRange();
  if (plage.count > 0) {
    doc.switchToPage(plage.start + plage.count - 1);
    dessinerVisa(doc, ecole, signaturePath);
    for (let i = 0; i < plage.count; i += 1) {
      doc.switchToPage(plage.start + i);
      dessinerPied(doc, i + 1, plage.count, ecole);
    }
  }

  doc.end();
}

module.exports = { genererFicheProclamation, decisionProclamation, trierParRang };
