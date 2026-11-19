// =====================================================================
// pdfkit — génération EN MÉMOIRE puis streaming au client.
// Interdit : écrire le PDF sur disque (seuls logo/photos sont des fichiers).
// =====================================================================
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const settingsRepo = require('../repositories/settingsRepository');

const BLEU = '#1d4ed8';
const BLEU_CLAIR = '#eff6ff';
const GRIS = '#64748b';
const GRIS_FONCE = '#1e293b';

/** Chemin disque du logo (ou null). */
async function lireCheminLogo() {
  try {
    const s = await settingsRepo.get();
    if (!s?.logo_path || !s.logo_path.startsWith('/uploads/')) return null;
    const segments = s.logo_path.split('/').filter((seg) => seg && seg !== '..' && seg !== '.'); // uploads / logo / fichier.png
    const disque = path.join(__dirname, '..', '..', ...segments);
    return fs.existsSync(disque) ? disque : null;
  } catch {
    return null;
  }
}

/** En-tête standard : logo (si présent) + nom de l'école + adresse. */
function enTete(doc, ecole, logoPath) {
  const y = doc.y;
  if (logoPath) {
    try { doc.image(logoPath, 40, y, { width: 64 }); } catch { /* logo illisible → ignoré */ }
  }
  doc.fontSize(17).fillColor(BLEU).font('Helvetica-Bold')
    .text(ecole.nom || 'École', logoPath ? 116 : 40, y + 2, { width: 430 });
  doc.fontSize(8.5).fillColor(GRIS).font('Helvetica');
  const ligne = [ecole.adresse, ecole.telephone, ecole.email].filter(Boolean).join('  ·  ');
  if (ligne) doc.text(ligne, logoPath ? 116 : 40, doc.y, { width: 430 });
  doc.moveTo(40, y + 58).lineTo(doc.page.width - 40, y + 58).lineWidth(2).strokeColor(BLEU).stroke();
  doc.y = y + 70;
}

function piedDePage(doc, totalPages) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const bas = doc.page.height - 55;
    doc.fontSize(7.5).fillColor(GRIS).font('Helvetica')
      .text('Document généré automatiquement — School Vie', 40, bas, { width: doc.page.width - 80, align: 'center' });
  }
}

/**
 * Crée un document PDF en mémoire.
 * @param {object} res réponse Express (pipe + headers positionnés par l'appelant)
 * @param {string} nomFichier nom proposé au téléchargement
 * @returns {Promise<PDFDocument>}
 */
async function creerDocument(res, nomFichier, options = {}) {
  const ecole = (await settingsRepo.get()) || {};
  const logoPath = await lireCheminLogo();
  const doc = new PDFDocument({
    size: 'A4',
    layout: options.paysage ? 'landscape' : 'portrait',
    margin: 40,
    bufferPages: true,
    info: { Title: nomFichier, Author: 'School Vie' },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nomFichier}"`);
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);
  enTete(doc, ecole, logoPath);
  return doc;
}

function titreDocument(doc, texte, sousTitre) {
  doc.fontSize(15).fillColor(GRIS_FONCE).font('Helvetica-Bold').text(texte);
  if (sousTitre) doc.fontSize(9.5).fillColor(GRIS).font('Helvetica').text(sousTitre);
  doc.moveDown(0.6);
}

/** Ligne label/valeur en deux colonnes. */
function ligneCleValeur(doc, cle, valeur, options = {}) {
  const y = doc.y;
  doc.fontSize(9.5).fillColor(GRIS).font('Helvetica').text(cle, 48, y, { width: 190 });
  doc.fontSize(10).fillColor(GRIS_FONCE).font('Helvetica-Bold').text(String(valeur ?? '—'), 238, y, { width: 300 });
  doc.y = y + 18;
}

/** Encadré montant (bandeau bleu clair). */
function encadreMontant(doc, libelle, montantFormate) {
  const y = doc.y + 6;
  doc.roundedRect(40, y, 515, 44, 6).fill(BLEU_CLAIR);
  doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(libelle, 56, y + 8);
  doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(17).text(montantFormate, 56, y + 18);
  doc.y = y + 58;
}

function finaliser(doc) {
  piedDePage(doc);
  doc.end();
}

// Les espaces insécables fines de toLocaleString('fr-FR') (U+202F) sont absents
// de la police Helvetica des PDF → on groupe les milliers avec des espaces simples.
const formatMontant = (valeur, devise = 'FCFA') => {
  const n = Number(valeur || 0);
  const neg = n < 0;
  const [entier, dec = '00'] = Math.abs(n).toFixed(2).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const nombre = dec === '00' ? groupe : `${groupe},${dec}`;
  return `${neg ? '-' : ''}${nombre} ${devise}`;
};

module.exports = {
  creerDocument, finaliser, titreDocument, ligneCleValeur, encadreMontant, formatMontant,
  enTete, lireCheminLogo, BLEU, BLEU_CLAIR, GRIS, GRIS_FONCE,
};
