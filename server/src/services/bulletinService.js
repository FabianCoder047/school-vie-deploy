// =====================================================================
// BULLETINS — modèle « RÉPUBLIQUE TOGOLAISE » (Travail – Liberté – Patrie).
// Une page A4 par élève, PDF généré en mémoire (pdfkit), jamais écrit sur
// disque. Contenu :
//   en-tête République togolaise + ministère + école ; année scolaire ;
//   informations de l'élève ; tableau des matières (moyenne, coef, total,
//   rang par matière, appréciation) ; moyenne générale + rang ;
//   résultat de l'élève sur toute l'année (tous les trimestres) ;
//   profil de la classe ; travail de l'élève ; conduite (absences
//   justifiées / non justifiées) ; décision du conseil de classe et visa
//   du Chef d'Établissement. AUCUN visa parent.
// =====================================================================
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const settingsRepo = require('../repositories/settingsRepository');
const pool = require('../config/db');
const { appreciation } = require('./moyenneService');
const { formatRang } = require('../utils/rang');
const { mentionsTravail } = require('../utils/mentions');
const { collecterDonneesAlias } = require('./classesDataService');
const { ApiError } = require('../utils/ApiError');

const BLEU = '#1e40af';
const BLEU_SOMBRE = '#16255f';
const JAUNE = '#eab308';
const VERT = '#15803d';
const ROUGE = '#b91c1c';
const GRIS = '#475569';
const GRIS_FONCE = '#0f172a';
const GRIS_CLAIR = '#94a3b8';
const BORDURE = '#cbd5e1';

/** Chemin disque d'une image uploadée (ou null). */
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

function coefFr(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return String(Math.round((n + Number.EPSILON) * 100) / 100).replace('.', ',');
}

function noteFr(v) {
  return v == null ? '—' : Number(v).toFixed(2).replace('.', ',');
}

function appreciationCourte(moy) {
  const a = appreciation(moy);
  return a ? a.toUpperCase() : '—';
}

/** Libellé court d'une période : « Trimestre 1 » → « T1 », « Semestre 2 » → « S2 ». */
function libelleCourt(libelle) {
  const m = String(libelle || '').match(/^(trimestre|semestre)\s*(\d+)/i);
  if (m) return (m[1].toLowerCase().startsWith('t') ? 'T' : 'S') + m[2];
  return String(libelle || '').slice(0, 10);
}

/** Filigrane : logo de l'école centré en arrière-plan, très discret. */
function filigraneLogo(doc, logoPath) {
  if (!logoPath) return;
  try {
    doc.save();
    doc.opacity(0.055);
    doc.image(logoPath, (595.28 - 240) / 2, 350, { fit: [240, 180], align: 'center', valign: 'center' });
    doc.restore();
    doc.opacity(1);
  } catch {
    doc.opacity(1);
  }
}

/** En-tête de bulletin : à gauche la République togolaise, à droite le logo et les infos de l'école. */
function enTeteBulletin(doc, ecole, logoPath) {
  const W = 595.28;
  const coteX = 40;
  const leftX = coteX;
  const leftW = 265;
  const rightX = 335;
  const rightW = W - coteX - rightX;
  const topY = 22;

  // --- Colonne gauche : République + devise + ministère
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(13)
    .text('RÉPUBLIQUE TOGOLAISE', leftX, topY, { width: leftW, characterSpacing: 1 });
  doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
    .text('Travail – Liberté – Patrie', leftX, doc.y + 1, { width: leftW });
  doc.moveTo(leftX, doc.y + 4).lineTo(leftX + 92, doc.y + 4).lineWidth(1.6).strokeColor(JAUNE).stroke();
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(8.4)
    .text('Ministère de l’Éducation Nationale', leftX, doc.y + 8, { width: leftW });
  const basGauche = doc.y;

  // --- Colonne droite : logo + nom + contacts
  let ry = topY;
  if (logoPath) {
    try { doc.image(logoPath, rightX + (rightW - 46) / 2, ry, { height: 44 }); ry += 47; } catch { /* ignore */ }
  }
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(10)
    .text(String(ecole?.nom || 'École').toUpperCase(), rightX, ry, { width: rightW, align: 'center' });
  const contact = [
    ecole?.bp ? `BP ${ecole.bp}` : null,
    ecole?.ville || null,
    ecole?.pays || null,
    ecole?.adresse || null,
    ecole?.telephone ? `Tél : ${ecole.telephone}` : null,
    ecole?.email || null,
  ].filter(Boolean).join('  ·  ');
  if (contact) {
    doc.fillColor(GRIS).font('Helvetica').fontSize(6.3)
      .text(contact, rightX, doc.y + 1, { width: rightW, align: 'center' });
  }
  const basDroite = doc.y;
  const bas = Math.max(basGauche, basDroite);

  // Séparateur vertical discret entre les deux colonnes
  doc.moveTo(315, topY - 2).lineTo(315, bas + 2).lineWidth(0.5).strokeColor(BORDURE).stroke();

  // Double filet (épais + fin), comme le modèle papier
  const ruleY = bas + 10;
  doc.moveTo(coteX, ruleY).lineTo(W - coteX, ruleY).lineWidth(2.1).strokeColor(GRIS_FONCE).stroke();
  doc.moveTo(coteX, ruleY + 3.4).lineTo(W - coteX, ruleY + 3.4).lineWidth(0.7).strokeColor(GRIS_FONCE).stroke();
  return ruleY + 3.4;
}

function champEleve(doc, x, y, largeur, label, valeur) {
  const libelle = `${label} : `;
  doc.fillColor(GRIS).font('Helvetica').fontSize(8.5).text(libelle, x, y, { lineBreak: false });
  const labelW = doc.widthOfString(libelle);
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(8.5)
    .text(String(valeur ?? '—'), x + labelW + 1, y, { width: Math.max(10, largeur - labelW - 1), ellipsis: true, lineBreak: false });
}



/** Dessine UNE page-bulletin pour un élève. */
function dessinerBulletin(doc, { eleve, periode, annee, matieres, moyenneClasse, effectif, statsClasse, resultatsAnnee, rang, ecole, logoPath, signaturePath, cachetPath }) {
  const W = 595.28;
  const coteX = 40;
  const contenuLargeur = W - 2 * coteX;

  // Filigrane (logo école) dessiné EN PREMIER, derrière tout le contenu
  filigraneLogo(doc, logoPath);

  const ruleY = enTeteBulletin(doc, ecole, logoPath);

  // --- Titre ---
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(14)
    .text(`BULLETIN SCOLAIRE — ${String(periode.libelle).toUpperCase()}`, 0, ruleY + 8, { width: W, align: 'center' });
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(9.5)
    .text(`Année scolaire : ${annee?.libelle || ''}`, 0, doc.y + 1, { width: W, align: 'center' });

  // --- INFORMATIONS DE L'ÉLÈVE ---
  const infoY = doc.y + 10;
  const infoH = 66;
  doc.roundedRect(coteX, infoY, contenuLargeur, infoH, 5).lineWidth(1.15).strokeColor(GRIS_FONCE).stroke();
  doc.fillColor(BLEU_SOMBRE).font('Helvetica-Bold').fontSize(8.5)
    .text('INFORMATIONS DE L’ÉLÈVE', coteX + 12, infoY + 7, { characterSpacing: 0.8 });
  const colLX = coteX + 14;
  const colRX = coteX + contenuLargeur / 2 + 6;
  const colW = contenuLargeur / 2 - 22;
  const sexeFr = eleve.sexe === 'M' ? 'Masculin' : eleve.sexe === 'F' ? 'Féminin' : (eleve.sexe || '—');
  champEleve(doc, colLX, infoY + 24, colW, 'Nom et prénoms', `${eleve.prenom} ${eleve.nom}`.toUpperCase());
  champEleve(doc, colRX, infoY + 24, colW, 'Matricule', eleve.matricule || '—');
  champEleve(doc, colLX, infoY + 39, colW, 'Né(e) le', `${dateFr(eleve.date_naissance)}${eleve.lieu_naissance ? ` à ${eleve.lieu_naissance}` : ''}`);
  champEleve(doc, colRX, infoY + 39, colW, 'Classe', eleve.alias_nom || eleve.classe_nom || '—');
  champEleve(doc, colLX, infoY + 54, colW, 'Effectif de la classe', String(effectif));
  champEleve(doc, colRX, infoY + 54, colW, 'Sexe', sexeFr);

  // --- Tableau des matières ---
  const tableY = infoY + infoH + 8;
  const colonnes = [
    { titre: 'Matières', largeur: 124, align: 'left' },
    { titre: 'Interro', largeur: 44, align: 'center' },
    { titre: 'Devoir', largeur: 44, align: 'center' },
    { titre: 'Compo', largeur: 44, align: 'center' },
    { titre: 'Moy.', largeur: 44, align: 'center' },
    { titre: 'Coef', largeur: 32, align: 'center' },
    { titre: 'Total', largeur: 46, align: 'center' },
    { titre: 'Rang', largeur: 40, align: 'center' },
    { titre: 'Appréciation', largeur: contenuLargeur - 124 - 44 * 3 - 44 - 32 - 46 - 40, align: 'left' },
  ];
  const nbMatieres = matieres.length;
  const rowH = nbMatieres > 16 ? 12 : nbMatieres > 11 ? 14.5 : 17.5;
  const headerH = 19;
  const policeMatiere = nbMatieres > 11 ? 6.5 : 7.5;

  let x = coteX;
  doc.roundedRect(coteX, tableY, contenuLargeur, headerH, 3).fill(BLEU);
  for (const col of colonnes) {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.8)
      .text(col.titre.toUpperCase(), x + 4, tableY + 6, { width: col.largeur - 8, align: col.align, characterSpacing: 0.3 });
    x += col.largeur;
  }
  let y = tableY + headerH;
  matieres.forEach((m, index) => {
    if (index % 2 === 0) doc.rect(coteX, y, contenuLargeur, rowH).fill('#f8fafc');
    const total = m.moyenne != null && m.coefficient ? Number(m.moyenne) * Number(m.coefficient) : null;
    const cellules = [
      { valeur: m.matiere, col: colonnes[0], gras: true, couleur: GRIS_FONCE },
      { valeur: noteFr(m.interro), col: colonnes[1] },
      { valeur: noteFr(m.devoir), col: colonnes[2] },
      { valeur: noteFr(m.compo), col: colonnes[3] },
      { valeur: noteFr(m.moyenne), col: colonnes[4], gras: true, couleur: m.moyenne == null ? GRIS_FONCE : m.moyenne >= 10 ? VERT : ROUGE },
      { valeur: coefFr(m.coefficient), col: colonnes[5] },
      { valeur: total != null ? noteFr(total) : '—', col: colonnes[6] },
      { valeur: formatRang(m.rang), col: colonnes[7] },
      { valeur: (m.appreciation || appreciation(m.moyenne) || '—').toString().slice(0, 26), col: colonnes[8], couleur: GRIS },
    ];
    let xx = coteX;
    for (const c of cellules) {
      if (c.col === colonnes[0]) {
        // Nom de matière : taille adaptative sur une ligne (ellipsis si trop long)
        const texte = String(c.valeur);
        const taille = texte.length > 44 ? 5.4 : texte.length > 34 ? 6.0 : texte.length > 24 ? 6.8 : policeMatiere;
        doc.fillColor(c.couleur || GRIS_FONCE).font('Helvetica-Bold').fontSize(taille)
          .text(texte, xx + 4, y + rowH / 2 - taille / 2 - 1, { width: c.col.largeur - 8, ellipsis: true, lineBreak: false });
      } else {
        doc.fillColor(c.couleur || GRIS_FONCE).font(c.gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(policeMatiere)
          .text(String(c.valeur), xx + 4, y + rowH / 2 - policeMatiere / 2 - 1, { width: c.col.largeur - 8, align: c.col.align, ellipsis: true, lineBreak: false });
      }
      xx += c.col.largeur;
    }
    doc.moveTo(coteX, y + rowH).lineTo(coteX + contenuLargeur, y + rowH).lineWidth(0.25).strokeColor('#e2e8f0').stroke();
    y += rowH;
  });
  // Bordure du tableau
  doc.roundedRect(coteX, tableY, contenuLargeur, y - tableY, 3).lineWidth(0.9).strokeColor(BORDURE).stroke();

  // --- MOYENNE GÉNÉRALE ---
  y += 7;
  const bandH = 27;
  doc.roundedRect(coteX, y, contenuLargeur, bandH, 5).fill(BLEU_SOMBRE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9.5)
    .text('MOYENNE GÉNÉRALE', coteX + 12, y + 8, { lineBreak: false, characterSpacing: 0.5 });
  doc.fillColor(JAUNE).font('Helvetica-Bold').fontSize(15)
    .text(noteFr(eleve.moyenneGenerale), 0, y + 4, { width: W, align: 'center' });
  doc.fillColor('#ffffff').font('Helvetica').fontSize(7.5)
    .text('sur 20', 0, y + 17, { width: W, align: 'center' });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10.5)
    .text(`Rang : ${formatRang(rang)}`, coteX + contenuLargeur - 122, y + 4, { width: 110, align: 'right' });
  doc.fillColor(JAUNE).font('Helvetica').fontSize(7.5)
    .text(appreciationCourte(eleve.moyenneGenerale), coteX + contenuLargeur - 122, y + 16, { width: 110, align: 'right' });

  // --- Bandeau 4 colonnes (résultat / profil / travail / conduite) ---
  y += bandH + 8;
  const gap = 4;
  const colW4 = (contenuLargeur - 3 * gap) / 4;
  const stripH = 104;
  const stripHeader = 15;
  const titres = ['RÉSULTAT DE L’ÉLÈVE', 'PROFIL DE LA CLASSE', 'TRAVAIL DE L’ÉLÈVE', 'CONDUITE DE L’ÉLÈVE'];
  for (let i = 0; i < 4; i++) {
    const cx = coteX + i * (colW4 + gap);
    doc.roundedRect(cx, y, colW4, stripHeader, 2).fill(BLEU);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.4)
      .text(titres[i], cx + 3, y + 4.5, { width: colW4 - 6, align: 'center', characterSpacing: 0.3 });
    doc.roundedRect(cx, y + stripHeader, colW4, stripH - stripHeader, 2).lineWidth(0.8).strokeColor(BORDURE).stroke();
  }
  const corpsY = y + stripHeader;
  const corpsH = stripH - stripHeader;

  // Colonne 1 — résultats de toute l'année (trimestres)
  const col1X = coteX;
  const lignePeriode = (ry, libelle, moy, rangPeriode, actuel) => {
    if (actuel) doc.rect(col1X + 2, ry, colW4 - 4, 13.5).fill('#fef9c3');
    doc.fillColor(GRIS_FONCE).font(actuel ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.2)
      .text(`${libelleCourt(libelle)} : `, col1X + 8, ry + 2.5, { continued: true, lineBreak: false });
    if (moy != null) {
      doc.font(actuel ? 'Helvetica-Bold' : 'Helvetica').text(`${noteFr(moy)}/20`, { continued: true });
      doc.fillColor(GRIS).text(`  ·  ${formatRang(rangPeriode)}`);
    } else {
      doc.fillColor(GRIS_CLAIR).text('—');
    }
  };
  let ry = corpsY + 5;
  const periodes = resultatsAnnee || [];
  // Réserve la place du verdict en bas (26 pt) : réduit l'interligne si beaucoup de périodes
  const stepPeriode = Math.min(13.5, (corpsH - 26 - 5) / Math.max(periodes.length, 1));
  periodes.forEach((r) => {
    lignePeriode(ry, r.libelle, r.moyenne, r.rang, Number(r.periodeId) === Number(periode.id));
    ry += stepPeriode;
  });
  // Verdict (appréciation) centré en bas de la colonne
  doc.fillColor(BLEU_SOMBRE).font('Helvetica-Bold').fontSize(11.5)
    .text(appreciationCourte(eleve.moyenneGenerale), col1X + 2, corpsY + corpsH - 22, { width: colW4 - 4, align: 'center' });

  // Colonne 2 — profil de la classe
  const col2X = coteX + colW4 + gap;
  const profil = [
    ['Admis (moy. 10/20)', statsClasse ? String(statsClasse.nbAdmis) : '—'],
    ['Moyenne classe', noteFr(statsClasse?.moyenneClasse ?? moyenneClasse)],
    ['% réussite', statsClasse ? `${String(statsClasse.pctReussite).replace('.', ',')} %` : '—'],
    ['Moyenne max', noteFr(statsClasse?.moyenneMax)],
    ['Moyenne min', noteFr(statsClasse?.moyenneMin)],
  ];
  let py = corpsY + 6;
  for (const [label, valeur] of profil) {
    doc.fillColor(GRIS).font('Helvetica').fontSize(7.2).text(label, col2X + 7, py, { width: colW4 - 44, lineBreak: false });
    doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(7.2).text(valeur, col2X + colW4 - 46, py, { width: 40, align: 'right', lineBreak: false });
    py += 15.5;
  }

  // Colonne 3 — travail de l'élève (mentions automatiques, conseil souverain)
  const col3X = coteX + 2 * (colW4 + gap);
  const mentions = mentionsTravail(eleve.moyenneGenerale);
  const travail = [
    ['Tableau d’Honneur', mentions.tableauHonneur],
    ['T.H + Encouragement', mentions.thomEncouragement],
    ['T.H + Félicitation', mentions.thomFelicitation],
    ['Avertissement Travail', mentions.avertissementTravail],
    ['Blâme Travail', mentions.blameTravail],
  ];
  let ty = corpsY + 6;
  for (const [label, oui] of travail) {
    doc.fillColor(GRIS).font('Helvetica').fontSize(6.9).text(label, col3X + 7, ty + 1, { width: colW4 - 34, lineBreak: false });
    doc.fillColor(oui ? VERT : GRIS_CLAIR).font('Helvetica-Bold').fontSize(7.2)
      .text(oui ? 'Oui' : 'Non', col3X + colW4 - 27, ty, { width: 22, align: 'right', lineBreak: false });
    ty += 15.5;
  }

  // Colonne 4 — conduite (assiduité)
  const col4X = coteX + 3 * (colW4 + gap);
  const conduite = [
    ['Absences totales', String(eleve.absences ?? 0)],
    ['Absences justifiées', String(eleve.absencesJustifiees ?? 0)],
    ['Absences non just.', String(eleve.absencesNonJustifiees ?? 0)],
    ['Retards', `${eleve.retards ?? 0} (${eleve.retardMinutes ?? 0} min)`],
  ];
  let cy = corpsY + 6;
  for (const [label, valeur] of conduite) {
    doc.fillColor(GRIS).font('Helvetica').fontSize(6.9).text(label, col4X + 7, cy + 1, { width: colW4 - 52, lineBreak: false });
    doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(7.4).text(valeur, col4X + colW4 - 44, cy, { width: 40, align: 'right', lineBreak: false });
    cy += 15.5;
  }

  // --- DÉCISION DU CONSEIL DE CLASSE / VISA DU CHEF D'ÉTABLISSEMENT ---
  y += stripH + 8;
  const visaH = 86;
  const wDecision = Math.round(contenuLargeur * 0.56);
  const wVisa = contenuLargeur - wDecision - gap;
  // Décision (vide — rempli par le conseil)
  doc.roundedRect(coteX, y, wDecision, visaH, 3).lineWidth(1.1).strokeColor(GRIS_FONCE).stroke();
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(7.5)
    .text('DÉCISION DU CONSEIL DE CLASSE', coteX + 10, y + 6, { characterSpacing: 0.5 });
  doc.moveTo(coteX + 14, y + visaH - 34).lineTo(coteX + wDecision - 14, y + visaH - 34).lineWidth(0.5).strokeColor(GRIS_CLAIR).stroke();
  doc.moveTo(coteX + 14, y + visaH - 12).lineTo(coteX + wDecision - 14, y + visaH - 12).lineWidth(0.5).strokeColor(GRIS_CLAIR).stroke();
  // Visa du Chef d'établissement
  const visaX = coteX + wDecision + gap;
  doc.roundedRect(visaX, y, wVisa, visaH, 3).lineWidth(1.1).strokeColor(GRIS_FONCE).stroke();
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(7.5)
    .text('VISA DU CHEF D’ÉTABLISSEMENT', visaX + 8, y + 6, { characterSpacing: 0.4 });
  doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
    .text(`Fait à ${ecole?.ville || 'Lomé'}, le ${dateFr(new Date())}`, visaX + 8, y + 18, { width: wVisa - 16, lineBreak: false });
  const sigW = 86;
  const sigX = visaX + wVisa - 14 - sigW;
  const lineY = y + visaH - 22;
  // Cachet (à gauche) : image ou cercle pointillé
  const cR = 14;
  const cX = visaX + 26;
  const cY = y + visaH - 30;
  doc.save();
  if (cachetPath) {
    try { doc.image(cachetPath, cX - cR - 2, cY - cR, { width: cR * 2 + 4, height: cR * 2 }); }
    catch { doc.circle(cX, cY, cR).dash(3, { space: 3 }).lineWidth(0.8).strokeColor(GRIS_CLAIR).stroke(); }
  } else {
    doc.circle(cX, cY, cR).dash(3, { space: 3 }).lineWidth(0.8).strokeColor(GRIS_CLAIR).stroke();
  }
  doc.restore();
  doc.fillColor(GRIS_CLAIR).font('Helvetica').fontSize(4.8).text('Cachet', cX - cR, cY + cR + 1, { width: cR * 2, align: 'center' });
  // Signature : image si disponible, sinon ligne + mention
  if (signaturePath) {
    try { doc.image(signaturePath, sigX, lineY - 14, { fit: [sigW, 12], align: 'center', valign: 'bottom' }); }
    catch { /* ignore */ }
  }
  doc.moveTo(sigX, lineY).lineTo(sigX + sigW, lineY).lineWidth(0.8).strokeColor(GRIS_FONCE).stroke();
  doc.fillColor(GRIS_FONCE).font('Helvetica-Bold').fontSize(7)
    .text(ecole?.directeur_nom?.trim() || 'Le Chef d’établissement', sigX, lineY + 3, { width: sigW, align: 'center', lineBreak: false });

  // --- Mentions bas de page ---
  const noteY = y + visaH + 6;
  doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(6.3)
    .text('Le bulletin est délivré sans rature, ni surcharge.', coteX, noteY, { lineBreak: false });
  doc.fillColor(GRIS_CLAIR).font('Helvetica').fontSize(6.3)
    .text(`Édité le ${dateFr(new Date())} — ${ecole?.nom || ''}`, coteX, noteY, { width: contenuLargeur, align: 'right', lineBreak: false });
}

/** Génère le PDF en mémoire et le streame au client. */
async function genererPdf(res, { academicYearId, classAliasIds, periodeId, titreFichier }) {
  const ecole = (await settingsRepo.get()) || {};
  const logoPath = cheminUpload(ecole.logo_path);
  const signaturePath = cheminUpload(ecole.signature_path);
  const cachetPath = cheminUpload(ecole.cachet_path);

  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false, info: { Title: titreFichier, Author: 'School Vie' } });
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
        eleve: { ...eleve, classe_nom: donnees.aliasInfo.classe_nom, alias_nom: donnees.aliasInfo.alias_nom },
        periode: donnees.periode,
        annee: donnees.annee,
        matieres: eleve.matieres,
        moyenneClasse: donnees.moyenneClasse,
        effectif: donnees.effectif,
        statsClasse: donnees.statsClasse,
        resultatsAnnee: eleve.resultatsAnnee,
        rang: eleve.rang ?? null,
        ecole,
        logoPath,
        signaturePath,
        cachetPath,
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
  const [[aliasInfo]] = await pool.query('SELECT nom FROM class_aliases WHERE id = ?', [classAliasId]).catch(() => [[null]]);
  const titre = aliasInfo?.nom ? `bulletins-${String(aliasInfo.nom).replace(/\s+/g, '-')}` : 'bulletins';
  await genererPdf(res, { academicYearId, classAliasIds: [Number(classAliasId)], periodeId, titreFichier: titre });
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
