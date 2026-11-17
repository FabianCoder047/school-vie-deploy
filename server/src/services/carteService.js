// =====================================================================
// CARTES SCOLAIRES — 8 cartes par page A4 (2 colonnes × 4 rangées),
// recto + verso « Je soussigné » intercalés par bloc de 8, PDF streamé.
// Fidèle au modèle :
//   recto — drapeau du Togo, en-tête République Togolaise / VIE,
//           SCHOOL VIE, coordonnées (BP/Tél/ville), « CARTE D'IDENTITÉ
//           SCOLAIRE », champs, photo, « Signature du Titulaire »,
//           ANNÉE SCOLAIRE en rouge.
//   verso — « Je soussigné …, Directeur de l'établissement …, certifie
//           que le/la titulaire … pour l'année scolaire … »,
//           fait à ville le date, « Le Directeur », cachet (pointillés
//           ou image) et ligne de signature.
// BP, ville, pays, nom du directeur, signature et cachet sont des
// PARAMÈTRES réglés par l'Administrateur (école).
// =====================================================================
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const settingsRepo = require('../repositories/settingsRepository');
const yearRepo = require('../repositories/academicYearRepository');
const pool = require('../config/db');
const { ApiError } = require('../utils/ApiError');

// Charte du modèle
const STL = '#2f74b5';        // cadre bleu acier
const BLEU_TITRE = '#2f74b5'; // titre SCHOOL VIE + labels
const FOND_BLEU = '#1e3a8a';
const ROUGE = '#c81f1f';      // rouge du modèle (sous-titre, ANNÉE, captions)
const TEAL = '#0e9a8c';       // séparateur / République Togolaise
const VERT = '#15803d';       // Travail · Liberté · Patrie
const TEXTE = '#16255f';      // Navy du modèle (textes)
const GRIS = '#475569';
const GRIS_CLAIR = '#94a3b8';

function cheminUpload(url) {
  if (!url || !String(url).startsWith('/uploads/')) return null;
  const segments = String(url).split('/').filter((s) => s && s !== '.' && s !== '..');
  const disque = path.join(__dirname, '..', '..', ...segments);
  return fs.existsSync(disque) ? disque : null;
}

const pad2 = (n) => String(n).padStart(2, '0');
const dateFr = (d) => {
  const j = new Date(d);
  if (Number.isNaN(j.getTime())) return '—';
  return `${pad2(j.getUTCDate())}/${pad2(j.getUTCMonth() + 1)}/${j.getUTCFullYear()}`;
};

/* ======================= Dessins vectoriels ======================= */

/** Drapeau du Togo : 5 bandes + canton rouge à étoile blanche. */
function drawTogoFlag(doc, x, y, w, h) {
  const stripe = h / 5;
  const bandes = ['#006a4e', '#ffce00', '#006a4e', '#ffce00', '#006a4e'];
  for (let i = 0; i < 5; i += 1) {
    doc.rect(x, y + i * stripe, w, stripe).fill(bandes[i]);
  }
  const cw = stripe * 3; // canton : 3/5 de la hauteur
  doc.rect(x, y, cw, stripe * 3).fill('#d21034');
  // Étoile blanche à 5 branches, centrée dans le canton
  const cx = x + cw / 2, cy = y + stripe * 1.5, r = stripe * 0.72;
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const rayon = i % 2 === 0 ? r : r * 0.382;
    points.push([cx + rayon * Math.cos(angle), cy + rayon * Math.sin(angle)]);
  }
  doc.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) doc.lineTo(points[i][0], points[i][1]);
  doc.closePath().fill('#ffffff');
}

/** Logo VIE vectoriel (cœur rouge + V bleu marine + bougie jaune + E vert + flamme). */
function drawVIE(doc, x, y, taille) {
  // Cœur (contour)
  const k = taille / 130; // unité = px du viewBox 130×100
  const p = (px, py) => [x + px * k, y + py * k];
  const [hx, hy] = p(65, 93);
  doc.save();
  doc.rect(x - 2, y - 2, taille + 4, taille * 0.78 + 4).clip();
  doc.moveTo(hx, hy);
  doc.bezierCurveTo(...p(33, 66), ...p(15, 46), ...p(15, 27));
  doc.bezierCurveTo(...p(15, 12), ...p(38, 8), ...p(51, 17));
  doc.bezierCurveTo(...p(58, 22), ...p(62, 25), ...p(65, 30));
  doc.bezierCurveTo(...p(68, 25), ...p(72, 22), ...p(79, 17));
  doc.bezierCurveTo(...p(92, 8), ...p(115, 12), ...p(115, 27));
  doc.bezierCurveTo(...p(115, 46), ...p(97, 66), ...p(65, 93));
  doc.lineWidth(2.6 * k).strokeColor('#e03224').stroke();
  doc.restore();
  // V
  doc.lineWidth(8.5 * k).strokeColor('#1f2766').lineCap('butt').lineJoin('miter');
  doc.moveTo(...p(11, 26)); doc.lineTo(...p(34.5, 74)); doc.lineTo(...p(58, 26));
  doc.stroke();
  // Bougie (I)
  doc.save();
  const [bx, by] = p(58.5, 30);
  doc.rect(bx, by, 13 * k, 42 * k).fill('#ffc61a');
  doc.restore();
  // Flamme
  const flamme = (dy, r, couleur) => {
    const [fx, fy] = p(65, dy);
    doc.save();
    doc.moveTo(fx, fy);
    doc.bezierCurveTo(fx - r, fy + r * 1.1, fx - r, fy + r * 1.9, fx, fy + r * 2.3);
    doc.bezierCurveTo(fx + r, fy + r * 1.9, fx + r, fy + r * 1.1, fx, fy);
    doc.fill(couleur);
    doc.restore();
  };
  flamme(3, 11.5 * k, '#e03224');
  flamme(8, 7 * k, '#f47b20');
  flamme(13, 3.8 * k, '#ffd21e');
  // E
  doc.fillColor('#1a9e4a');
  const rect = (px, py, pw, ph) => { const [rx, ry] = p(px, py); doc.rect(rx, ry, pw * k, ph * k).fill(); };
  rect(79, 25, 10, 49);
  rect(79, 25, 46, 9.5);
  rect(79, 44.75, 39, 9.5);
  rect(79, 64.5, 46, 9.5);
}

/** Place le logo de l'établissement (settings) ou, à défaut, le VIE vectoriel. */
function placerEcoleLogo(doc, { x, y, h, logoPath }) {
  if (logoPath) {
    try { doc.image(logoPath, x, y, { height: h }); return; } catch { /* ignore */ }
  }
  drawVIE(doc, x, y - 2, h + 2);
}

/* ======================= RECTO ======================= */

function dessinerRecto(doc, { x, y, w, h, eleve, ecole, anneeLibelle, photoPath, logoPath }) {
  const pad = 9;
  // Cadre bleu acier, coins arrondis
  doc.roundedRect(x, y, w, h, 6).lineWidth(2.2).strokeColor(STL).stroke();

  // --- En-tête : drapeau + textes + logo
  const flagW = 31, flagH = 20;
  drawTogoFlag(doc, x + pad, y + 9, flagW, flagH);
  doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(7.4)
    .text('République Togolaise', x + pad + flagW + 4, y + 9, { lineBreak: false });
  doc.fillColor(VERT).font('Helvetica').fontSize(5.6)
    .text('Travail · Liberté · Patrie', x + pad + flagW + 4, y + 19, { lineBreak: false });
  // Logo à droite
  const logoH = 27;
  const logoW = logoH; // approximatif (carré)
  placerEcoleLogo(doc, { x: x + w - pad - logoW, y: y + 6, h: logoH, logoPath });

  // --- SCHOOL VIE (nom de l'école, centré)
  const nomEcole = String(ecole?.nom || 'SCHOOL VIE').toUpperCase();
  doc.fillColor(BLEU_TITRE).font('Helvetica-Bold').fontSize(13)
    .text(nomEcole, x + pad, y + 34, { width: w - pad * 2, align: 'center', characterSpacing: 1.1, lineBreak: false });

  // --- Ligne coordonnées (BP / Tél / ville - pays)
  const bp = ecole?.bp || '.........';
  const tel = ecole?.telephone || '.........';
  const lieu = [ecole?.ville || 'Lomé', ecole?.pays || 'TOGO'].join(' - ');
  doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(6.1)
    .text(`BP : ${bp}     Tél : ${tel}     •  ${lieu}`, x + pad, y + 50, { width: w - pad * 2, align: 'center', lineBreak: false });

  // --- Séparateur teal
  doc.moveTo(x + pad, y + 60).lineTo(x + w - pad, y + 60).lineWidth(1.4).strokeColor(TEAL).stroke();

  // --- Sous-titre rouge
  doc.fillColor(ROUGE).font('Helvetica-Bold').fontSize(7.6)
    .text('CARTE D’IDENTITÉ SCOLAIRE', x + pad, y + 65, { lineBreak: false });

  // --- Photo (ou VIE en remplacement)
  const phW = 46, phH = 58;
  const phX = x + w - pad - phW, phY = y + 76;
  if (photoPath) {
    try {
      doc.save();
      doc.roundedRect(phX, phY, phW, phH, 3).clip();
      doc.image(photoPath, phX, phY, { cover: [phW, phH], align: 'center', valign: 'center' });
      doc.restore();
      doc.roundedRect(phX, phY, phW, phH, 3).lineWidth(1).strokeColor('#cbd5e1').stroke();
    } catch { photoPath = null; }
  }
  if (!photoPath) {
    doc.roundedRect(phX, phY, phW, phH, 3).lineWidth(1).strokeColor('#cbd5e1').stroke();
    drawVIE(doc, phX + 6, phY + 8, phW - 12);
  }
  // Légende rouge + filet rouge sous la photo
  doc.moveTo(phX, phY + phH + 4).lineTo(phX + phW, phY + phH + 4).lineWidth(0.9).strokeColor(ROUGE).stroke();
  doc.fillColor(ROUGE).font('Helvetica-Oblique').fontSize(5.6)
    .text('Signature du Titulaire', phX - 8, phY + phH + 7, { width: phW + 16, align: 'center', lineBreak: false });

  // --- Champs (Nom … Sexe)
  const champs = [
    ['Nom', String(eleve.nom || '').toUpperCase()],
    ['Prénoms', eleve.prenom || ''],
    ['Né(e) le', dateFr(eleve.date_naissance)],
    ['Lieu de naiss.', eleve.lieu_naissance || '—'],
    ['Classe', eleve.alias_nom || eleve.classe_nom || ''],
    ['N° Mle', eleve.matricule || ''],
    ['Sexe', eleve.sexe === 'M' ? 'Masculin' : eleve.sexe === 'F' ? 'Féminin' : (eleve.sexe || '—')],
  ];
  const labelW = 52, valueX = x + pad + labelW, valueW = phX - valueX - 4;
  let fy = y + 77;
  for (const [label, value] of champs) {
    doc.fillColor(FOND_BLEU).font('Helvetica-Bold').fontSize(6.4)
      .text(label, x + pad, fy, { lineBreak: false });
    doc.fillColor(TEXTE).font('Helvetica').fontSize(6.8)
      .text(String(value), valueX, fy, { width: valueW, ellipsis: true, lineBreak: false });
    fy += 10;
  }

  // --- Année scolaire (rouge, gras, bas de carte)
  doc.fillColor(ROUGE).font('Helvetica-Bold').fontSize(7.6)
    .text(`ANNÉE SCOLAIRE : ${anneeLibelle}`, x + pad, y + h - 14, { lineBreak: false });
}

/* ======================= VERSO ======================= */

function dessinerVerso(doc, { x, y, w, h, ecole, anneeLibelle, signaturePath, cachetPath }) {
  const pad = 12;
  doc.roundedRect(x, y, w, h, 6).lineWidth(2.2).strokeColor(STL).stroke();

  const dots = (n) => '.'.repeat(n);
  const nom = ecole?.nom || 'SCHOOL VIE';
  const lieu = ecole?.ville || 'Lomé';
  const directeur = ecole?.directeur_nom?.trim() || dots(22);
  const today = dateFr(new Date());

  // Paragraphe de certification
  doc.fillColor(TEXTE).font('Helvetica').fontSize(6.9);
  const texteCertif = `Je soussigné ${directeur}, Directeur de l’établissement ${nom}, certifie que le/la titulaire de cette carte est élève dans mon établissement pour l’année scolaire ${anneeLibelle}.`;
  doc.text(texteCertif, x + pad, y + 14, { width: w - pad * 2, lineGap: 2.6 });

  // Fait à … le … + Le Directeur (alignés à droite)
  doc.fillColor(GRIS).font('Helvetica').fontSize(6.4)
    .text(`Fait à ${lieu}, le ${today}`, x, y + h - 63, { width: w - pad, align: 'right', lineBreak: false });
  doc.fillColor(FOND_BLEU).font('Helvetica-Bold').fontSize(7.4)
    .text('Le Directeur', x, y + h - 51, { width: w - pad, align: 'right', lineBreak: false });

  // Cachet : cercle pointillé à gauche, image si fournie par l'admin
  const cR = 15;
  const cX = x + pad + cR, cY = y + h - 42;
  doc.save();
  if (cachetPath) {
    try { doc.image(cachetPath, cX - cR - 2, cY - cR, { width: cR * 2 + 4, height: cR * 2 }); }
    catch { doc.circle(cX, cY, cR).dash(3, { space: 3 }).lineWidth(0.9).strokeColor(GRIS_CLAIR).stroke(); }
  } else {
    doc.circle(cX, cY, cR).dash(3, { space: 3 }).lineWidth(0.9).strokeColor(GRIS_CLAIR).stroke();
  }
  doc.restore(); // ne pas propager le pointillé hors du cercle
  doc.fillColor(GRIS_CLAIR).font('Helvetica').fontSize(4.6)
    .text('Cachet', cX - cR - 4, cY + cR + 1, { width: cR * 2 + 8, align: 'center', lineBreak: false });

  // Signature du directeur : image au-dessus de la ligne
  const lineY = y + h - 26;
  const sigX = x + w - pad - 92, sigW = 92;
  if (signaturePath) {
    try { doc.image(signaturePath, sigX, lineY - 15, { fit: [sigW, 13], align: 'center', valign: 'bottom' }); }
    catch { /* ignore */ }
  }
  doc.moveTo(sigX, lineY).lineTo(sigX + sigW, lineY).lineWidth(0.9).strokeColor('#111827').stroke();
}

/* ======================= Génération ======================= */

/** Cartes des élèves d'un ensemble d'alias (classe ou cycle), 8/page A4. Recto + verso. */
async function genererCartes(res, { academicYearId, classAliasIds, titreFichier }) {
  if (!Array.isArray(classAliasIds) || classAliasIds.length === 0) {
    throw ApiError.badRequest('Choisissez une classe, un alias ou un cycle.', 'CIBLE_REQUISE');
  }
  const ecole = (await settingsRepo.get()) || {};
  const logoPath = cheminUpload(ecole.logo_path);
  const signaturePath = cheminUpload(ecole.signature_path);
  const cachetPath = cheminUpload(ecole.cachet_path);
  const annee = await yearRepo.findById(academicYearId);
  const anneeLibelle = annee?.libelle || '';

  const placeholders = classAliasIds.map(() => '?').join(',');
  const [eleves] = await pool.query(
    `SELECT e.id, s.matricule, s.nom, s.prenom, s.sexe, s.date_naissance, s.lieu_naissance, s.photo_path,
            cl.nom AS classe_nom, a.nom AS alias_nom, cy.nom AS cycle_nom
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_aliases a ON a.id = e.class_alias_id
       JOIN classes cl ON cl.id = a.class_id
       JOIN cycles cy ON cy.id = cl.cycle_id
      WHERE e.class_alias_id IN (${placeholders}) AND e.academic_year_id = ? AND e.statut <> 'ANNULE'
      ORDER BY cy.ordre, cl.ordre, a.nom, s.nom, s.prenom`,
    [...classAliasIds, academicYearId]
  );

  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false, info: { Title: titreFichier, Author: 'School Vie' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${titreFichier}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);

  const PAGE_W = 595.28, PAGE_H = 841.89;
  const MARGE_X = 22, MARGE_Y = 20;
  const GAP_X = 14, GAP_Y = 10;
  const COLS = 2, LIGNES = 4;
  const cardW = (PAGE_W - 2 * MARGE_X - (COLS - 1) * GAP_X) / COLS;
  const cardH = (PAGE_H - 2 * MARGE_Y - (LIGNES - 1) * GAP_Y) / LIGNES;

  if (eleves.length === 0) {
    doc.addPage({ size: 'A4', margin: 0 });
    doc.fillColor(TEXTE).font('Helvetica-Bold').fontSize(14).text('Aucun élève à imprimer pour ces critères.', 60, 60);
    doc.end();
    return;
  }

  // Même disposition recto/verso : 8 élèves par planche, une page recto puis une page verso.
  for (let debut = 0; debut < eleves.length; debut += COLS * LIGNES) {
    const lot = eleves.slice(debut, debut + COLS * LIGNES);
    // --- Page recto
    doc.addPage({ size: 'A4', margin: 0 });
    lot.forEach((eleve, i) => {
      const ligne = Math.floor(i / COLS), col = i % COLS;
      dessinerRecto(doc, {
        x: MARGE_X + col * (cardW + GAP_X), y: MARGE_Y + ligne * (cardH + GAP_Y), w: cardW, h: cardH,
        eleve, ecole, anneeLibelle, photoPath: cheminUpload(eleve.photo_path), logoPath,
      });
    });
    // --- Page verso (mêmes emplacements, même ordre → même nombre de cartes au dos)
    doc.addPage({ size: 'A4', margin: 0 });
    lot.forEach((eleve, i) => {
      const ligne = Math.floor(i / COLS), col = i % COLS;
      dessinerVerso(doc, {
        x: MARGE_X + col * (cardW + GAP_X), y: MARGE_Y + ligne * (cardH + GAP_Y), w: cardW, h: cardH,
        eleve, ecole, anneeLibelle, signaturePath, cachetPath,
      });
    });
  }
  doc.end();
}

/** Cartes d'un alias. */
async function genererCartesAlias(res, { academicYearId, classAliasId }) {
  await genererCartes(res, { academicYearId, classAliasIds: [Number(classAliasId)], titreFichier: 'cartes-scolaires' });
}

/** Cartes de tous les alias d'un cycle. */
async function genererCartesCycle(res, { academicYearId, cycleId }) {
  const [aliases] = await pool.query(
    `SELECT a.id AS class_alias_id FROM class_aliases a JOIN classes cl ON cl.id = a.class_id
      WHERE cl.cycle_id = ? ORDER BY cl.ordre, a.nom`,
    [cycleId]
  );
  if (aliases.length === 0) throw ApiError.notFound('Aucun alias pour ce cycle.');
  await genererCartes(res, { academicYearId, classAliasIds: aliases.map((a) => a.class_alias_id), titreFichier: 'cartes-scolaires-cycle' });
}

module.exports = { genererCartesAlias, genererCartesCycle };
