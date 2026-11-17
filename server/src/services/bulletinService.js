// =====================================================================
// BULLETINS — génération PDF en mémoire (pdfkit), une page par élève,
// jamais écrits sur disque. Notes par matière, moyennes (service unique),
// rang dans la classe, moyenne de classe, absences/retards.
// =====================================================================
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const settingsRepo = require('../repositories/settingsRepository');
const yearRepo = require('../repositories/academicYearRepository');
const periodRepo = require('../repositories/evaluationPeriodRepository');
const pool = require('../config/db');
const { appreciation } = require('./moyenneService');
const { collecterDonneesAlias } = require('./classesDataService');
const { ApiError } = require('../utils/ApiError');

const BLEU = '#1e40af';
const BLEU_SOMBRE = '#16255f';
const BLEU_CLAIR = '#eff6ff';
const JAUNE = '#eab308';
const VERT = '#15803d';
const ROUGE = '#b91c1c';
const GRIS = '#64748b';
const GRIS_FONCE = '#1e293b';

const devicePath = (segments) => path.join(__dirname, '..', '..', ...segments);

/** Chemin disque d'une photo/logo (ou null). */
function cheminUpload(url) {
  if (!url || !String(url).startsWith('/uploads/')) return null;
  const segments = String(url).split('/').filter((s) => s && s !== '.' && s !== '..');
  const disque = path.join(__dirname, '..', '..', ...segments);
  return fs.existsSync(disque) ? disque : null;
}

function dateFr(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** En-tête de bulletin (bandeau bleu + logo + école). */
function enTeteBulletin(doc, ecole, logoPath) {
  const y = 36;
  doc.rect(0, 0, 595.28, 96).fill(BLEU_SOMBRE);
  doc.rect(0, 96, 595.28, 4).fill(JAUNE);
  if (logoPath) {
    try { doc.image(logoPath, 40, y, { width: 66, height: 54 }); } catch { /* ignore */ }
  }
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text(ecole?.nom || 'École', logoPath ? 118 : 40, y + 2, { width: 380 });
  const ligne = [ecole?.adresse, ecole?.telephone, ecole?.email].filter(Boolean).join('  ·  ');
  if (ligne) doc.moveDown(0.25), doc.font('Helvetica').fontSize(8).fillColor('#bfdbfe').text(ligne, logoPath ? 118 : 40, doc.y, { width: 420 });
  doc.fontSize(8.5).fillColor(JAUNE).font('Helvetica-Bold').text('BULLETIN SCOLAIRE', 40, 74);
}

function initiales(nom, prenom) {
  return `${(nom || '?')[0] || '?'}${(prenom || '?')[0] || '?'}`.toUpperCase();
}

/** Dessine UNE page-bulletin pour un élève. */
function dessinerBulletin(doc, { eleve, periode, annee, matieres, moyenneClasse, effectif, absences, retards, retardMinutes, rang, ecole, logoPath, photoPath }) {
  enTeteBulletin(doc, ecole, logoPath);

  // Filigrane discret
  doc.save();
  doc.opacity(0.05).fillColor(BLEU_SOMBRE).font('Helvetica-Bold').fontSize(72);
  doc.rotate(-30, { origin: [300, 400] });
  doc.text('SCHOOL VIE', 60, 400);
  doc.restore();

  // Titre
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(14)
    .text(`BULLETIN — ${periode.libelle.toUpperCase()}`, 40, 118);
  doc.fillColor(GRIS).font('Helvetica').fontSize(9)
    .text(`Année académique ${annee.libelle}  ·  Édité le ${dateFr(new Date())}`, 40, doc.y + 2);

  // ===== Bloc élève =====
  const boxY = 160;
  doc.roundedRect(40, boxY, 515, 82, 8).lineWidth(1).strokeColor('#dbe4f0').stroke();
  // Photo
  if (photoPath) {
    try {
      doc.save();
      doc.roundedRect(52, boxY + 8, 66, 66, 6).clip();
      doc.image(photoPath, 52, boxY + 8, { cover: [66, 66], align: 'center', valign: 'center' });
      doc.restore();
    } catch { photoPath = null; }
  }
  if (!photoPath) {
    doc.roundedRect(52, boxY + 8, 66, 66, 6).fill(BLEU_CLAIR);
    doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(22).text(initiales(eleve.nom, eleve.prenom), 52, boxY + 30, { width: 66, align: 'center' });
  }
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(12.5)
    .text(`${eleve.prenom} ${eleve.nom}`, 130, boxY + 8, { width: 250 });
  doc.fillColor(GRIS).font('Helvetica').fontSize(8.5)
    .text(`Né(e) le ${dateFr(eleve.date_naissance)}${eleve.lieu_naissance ? ` à ${eleve.lieu_naissance}` : ''}`, 130, doc.y + 1, { width: 250 });
  doc.text(`Matricule : ${eleve.matricule}`, 130, doc.y + 1, { width: 250 });

  // Stats à droite du bloc
  const statX = 400;
  const stats = [
    ['Moyenne', eleve.moyenneGenerale != null ? eleve.moyenneGenerale.toFixed(2) : '—'],
    ['Rang', rang != null ? `${rang} / ${effectif}` : '—'],
    ['Moy. classe', moyenneClasse != null ? moyenneClasse.toFixed(2) : '—'],
  ];
  stats.forEach(([label, value], i) => {
    const yy = boxY + 8 + i * 24;
    doc.roundedRect(statX, yy, 120, 20, 4).fill(i === 0 ? BLEU : '#f1f5f9');
    doc.fillColor(i === 0 ? '#ffffff' : GRIS).font('Helvetica').fontSize(7).text(label.toUpperCase(), statX + 6, yy + 2);
    doc.fillColor(i === 0 ? '#ffffff' : GRIS_FONCE).font('Helvetica-Bold').fontSize(11).text(String(value), statX + 6, yy + 9);
  });

  // ===== Tableau des matières =====
  const tableY = 258;
  const colonnes = [
    { titre: 'Matière', width: 128 },
    { titre: 'Coef', width: 34, align: 'center' },
    { titre: 'Interro', width: 62, align: 'center' },
    { titre: 'Devoir', width: 62, align: 'center' },
    { titre: 'Compo', width: 62, align: 'center' },
    { titre: 'Moy.', width: 78, align: 'center' },
    { titre: 'Appréciation', width: 89, align: 'center' },
  ];
  const largeurTable = colonnes.reduce((acc, c) => acc + c.width, 0);
  let x = 40;
  doc.roundedRect(40, tableY, largeurTable, 22, 4).fill(BLEU);
  for (const col of colonnes) {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
      .text(col.titre.toUpperCase(), x + 4, tableY + 7, { width: col.width - 8, align: col.align || 'left' });
    x += col.width;
  }
  let y = tableY + 22;
  const hauteur = 21;

  matieres.forEach((m, index) => {
    if (index % 2 === 0) doc.rect(40, y, largeurTable, hauteur).fill('#f8fafc');
    let xx = 40;
    const cellule = (valeur, col, couleur = GRIS_FONCE, gras = false) => {
      doc.fillColor(couleur).font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
        .text(valeur == null ? '—' : String(valeur), xx + 4, y + 6, { width: col.width - 8, align: col.align || 'left' });
      xx += col.width;
    };
    const couleurMoy = (moy) => (moy == null ? GRIS_FONCE : moy >= 10 ? VERT : ROUGE);
    cellule(m.matiere, colonnes[0], GRIS_FONCE, true);
    cellule(m.coefficient, colonnes[1]);
    cellule(m.interro?.toFixed(2) ?? null, colonnes[2]);
    cellule(m.devoir?.toFixed(2) ?? null, colonnes[3]);
    cellule(m.compo?.toFixed(2) ?? null, colonnes[4]);
    cellule(m.moyenne?.toFixed(2) ?? null, colonnes[5], couleurMoy(m.moyenne), true);
    cellule(m.appreciation || appreciation(m.moyenne) || '—', colonnes[6], GRIS);
    y += hauteur;
  });

  // ===== Ligne moyenne générale =====
  y += 4;
  doc.roundedRect(40, y, largeurTable, 30, 6).fill(BLEU_SOMBRE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
    .text('MOYENNE GÉNÉRALE', 54, y + 6, { width: 200 });
  doc.fillColor(JAUNE).font('Helvetica-Bold').fontSize(15)
    .text(eleve.moyenneGenerale != null ? eleve.moyenneGenerale.toFixed(2) : '—', 300, y + 4, { width: 90, align: 'center' });
  doc.fillColor('#ffffff').font('Helvetica').fontSize(8)
    .text(`Rang : ${rang ?? '—'} / ${effectif}`, 400, y + 5, { width: 140 });
  doc.fillColor(JAUNE).fontSize(8.5)
    .text(appreciation(eleve.moyenneGenerale) || '', 400, y + 16, { width: 140 });

  // ===== Absences / retards =====
  y += 44;
  doc.roundedRect(40, y, largeurTable, 48, 6).lineWidth(1).strokeColor('#dbe4f0').stroke();
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(9).text('ASSIDUITÉ', 54, y + 6);
  doc.fillColor(GRIS).font('Helvetica').fontSize(8.5)
    .text(`Absences : ${absences} séance${absences > 1 ? 's' : ''}   ·   Retards : ${retards} (${retardMinutes} minute${retardMinutes > 1 ? 's' : ''} au total)`, 54, y + 20);
  doc.fillColor(GRIS).fontSize(7.5)
    .text('Toute absence non justifiée est signalée aux parents.', 54, y + 32);

  // ===== Pied : signature =====
  const piedY = 715;
  doc.fillColor(GRIS).font('Helvetica').fontSize(8.5).text(`Fait à …………………, le ${dateFr(new Date())}`, 40, piedY - 14);
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(9.5).text('Le Directeur', 380, piedY);
  doc.moveTo(330, piedY + 34).lineTo(555, piedY + 34).lineWidth(0.75).strokeColor(GRIS).stroke();
  doc.fontSize(7).fillColor(GRIS).text('Cachet et signature', 380, piedY + 38);
}


/** Génère le PDF en mémoire et le streame au client. */
async function genererPdf(res, { academicYearId, classAliasIds, periodeId, titreFichier }) {
  const ecole = (await settingsRepo.get()) || {};
  const logoPath = cheminUpload(ecole.logo_path);

  const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: false, info: { Title: titreFichier, Author: 'School Vie' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${titreFichier}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);

  let pages = 0;
  for (const aliasId of classAliasIds) {
    const donnees = await collecterDonneesAlias({ academicYearId, classAliasId: aliasId, periodeId });
    if (donnees.eleves.length === 0) continue;
    for (const eleve of donnees.eleves) {
      doc.addPage(); // une page par élève (bulletin)
      pages += 1;
      dessinerBulletin(doc, {
        eleve,
        periode: donnees.periode,
        annee: donnees.annee,
        matieres: eleve.matieres,
        moyenneClasse: donnees.moyenneClasse,
        effectif: donnees.effectif,
        absences: eleve.absences,
        retards: eleve.retards,
        retardMinutes: eleve.retardMinutes,
        rang: eleve.rang ?? null,
        ecole,
        logoPath,
        photoPath: cheminUpload(eleve.photo_path),
      });
    }
  }
  if (pages === 0) {
    doc.addPage();
    doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(14).text('Aucun élève inscrit pour ces critères.', 60, 60);
  }
  doc.end();
}

/** Bulletins d'une classe/alias pour une période. */
async function genererBulletinsAlias(res, { academicYearId, classAliasId, periodeId }) {
  const { aliasInfo } = await collecterDonneesAlias({ academicYearId, classAliasId, periodeId }).catch(async (e) => {
    if (e.status === 404) return { aliasInfo: null, eleves: [], moyenneClasse: null, effectif: 0, periode: null, annee: null };
    throw e;
  });
  const titre = aliasInfo ? `bulletins-${aliasInfo.alias_nom.replace(/\s+/g, '-')}` : 'bulletins';
  const ids = [Number(classAliasId)];
  await genererPdf(res, { academicYearId, classAliasIds: ids, periodeId, titreFichier: titre });
}

/** Bulletins de tous les alias d'un cycle pour une période. */
async function genererBulletinsCycle(res, { academicYearId, cycleId, periodeId }) {
  const [aliases] = await pool.query(
    `SELECT a.id AS class_alias_id FROM class_aliases a
       JOIN classes cl ON cl.id = a.class_id
      WHERE cl.cycle_id = ? ORDER BY cl.ordre, a.nom`,
    [cycleId]
  );
  const ids = aliases.map((a) => a.class_alias_id);
  if (ids.length === 0) throw ApiError.notFound('Aucun alias pour ce cycle.');
  await genererPdf(res, { academicYearId, classAliasIds: ids, periodeId, titreFichier: 'bulletins-cycle' });
}

module.exports = { genererBulletinsAlias, genererBulletinsCycle };
