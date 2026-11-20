// =====================================================================
// Impression des emplois du temps (PDF A4 paysage, généré à la volée).
// Une page par alias : grille Lundi → Vendredi, heures de 55 min,
// pause 09:45–10:10, retour 14:30, primaire → fin 11:30.
// =====================================================================
const { ApiError } = require('../utils/ApiError');
const yearRepo = require('../repositories/academicYearRepository');
const aliasRepo = require('../repositories/classAliasRepository');
const timetableRepo = require('../repositories/timetableRepository');
const settingsRepo = require('../repositories/settingsRepository');
const horaires = require('../config/horairesScolaires');
const pdf = require('../utils/pdf');

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const HAUTEUR_LIGNE = 22;
const HAUTEUR_PAUSE = 19;
const LARGEUR_HEURE = 62;

function nettoyerNom(texte) {
  return String(texte || 'edt')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

/** Lignes de la grille : créneaux + bandes de pause.
 *  Primaire : durées libres → une ligne par cours réellement saisi. */
function construireLignes(regles, primaire, creneaux = []) {
  const plages = horaires.plages(regles, primaire);
  const lignes = [];
  for (let index = 0; index < plages.length; index += 1) {
    const plage = plages[index];
    const debut = horaires.enMinutes(plage.debut);
    const fin = horaires.enMinutes(plage.fin);
    if (primaire) {
      const duMoment = creneaux
        .filter((c) => {
          const d = horaires.enMinutes(String(c.heure_debut).slice(0, 5));
          return d >= debut && d < fin;
        })
        .sort((a, b) => horaires.enMinutes(String(a.heure_debut).slice(0, 5)) - horaires.enMinutes(String(b.heure_debut).slice(0, 5)));
      if (duMoment.length > 0) {
        const vus = new Set();
        for (const c of duMoment) {
          const debutCreneau = String(c.heure_debut).slice(0, 5);
          const finCreneau = String(c.heure_fin).slice(0, 5);
          const cle = `${debutCreneau}-${finCreneau}`;
          if (vus.has(cle)) continue;
          vus.add(cle);
          lignes.push({
            debut: horaires.enMinutes(debutCreneau),
            fin: horaires.enMinutes(finCreneau),
            libelle: `${debutCreneau} – ${finCreneau}`,
            pause: false,
          });
        }
      } else {
        lignes.push({ debut, fin, libelle: `${plage.debut} – ${plage.fin}`, pause: false });
      }
    } else {
      for (let t = debut; t + regles.dureeHeureMinutes <= fin; t += regles.dureeHeureMinutes) {
        const f = t + regles.dureeHeureMinutes;
        lignes.push({
          debut: t, fin: f,
          libelle: `${horaires.enHeure(t)} – ${horaires.enHeure(f)}`,
          pause: false,
        });
      }
    }
    if (index === 0) {
      lignes.push({ pause: true, libelle: `Pause ${regles.pause.debut} – ${regles.pause.fin}` });
    }
    if (index === 1) {
      lignes.push({ pause: true, libelle: `Retour à ${regles.debutApresMidi}` });
    }
  }
  return lignes;
}

/** Index de la ligne où commence un créneau, et nombre de lignes couvertes. */
function placerCreneau(lignes, creneau) {
  const debut = horaires.enMinutes(String(creneau.heure_debut).slice(0, 5));
  const fin = horaires.enMinutes(String(creneau.heure_fin).slice(0, 5));
  const depart = lignes.findIndex((l) => !l.pause && debut >= l.debut && debut < l.fin);
  if (depart < 0) return null;
  let finIndex = depart;
  while (finIndex + 1 < lignes.length && !lignes[finIndex + 1].pause && lignes[finIndex + 1].debut < fin) {
    finIndex += 1;
  }
  return { depart, finIndex };
}

function dessinerGrille(doc, { creneaux, regles, primaire }) {
  const lignes = construireLignes(regles, primaire, creneaux);
  const x0 = 40;
  const largeur = doc.page.width - 80;
  const largeurJour = (largeur - LARGEUR_HEURE) / 5;
  let y = doc.y;

  // En-tête des jours
  doc.rect(x0, y, largeur, HAUTEUR_LIGNE + 4).fill('#1e293b');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
    .text('HEURE', x0 + 6, y + 7, { width: LARGEUR_HEURE - 10 });
  JOURS.forEach((jour, i) => {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
      .text(jour, x0 + LARGEUR_HEURE + i * largeurJour, y + 7, { width: largeurJour, align: 'center' });
  });
  y += HAUTEUR_LIGNE + 4;

  // Lignes
  for (const ligne of lignes) {
    const hauteur = ligne.pause ? HAUTEUR_PAUSE : HAUTEUR_LIGNE;
    if (ligne.pause) {
      doc.rect(x0, y, largeur, hauteur).fill('#fffbeb');
      doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(7.5)
        .text(ligne.libelle, x0, y + 5, { width: largeur, align: 'center' });
    } else {
      doc.rect(x0, y, LARGEUR_HEURE, hauteur).fill('#f1f5f9');
      doc.fillColor('#475569').font('Helvetica').fontSize(7)
        .text(ligne.libelle, x0 + 4, y + (hauteur - 9) / 2, { width: LARGEUR_HEURE - 8 });

      for (let jour = 1; jour <= 5; jour += 1) {
        const x = x0 + LARGEUR_HEURE + (jour - 1) * largeurJour;
        doc.rect(x, y, largeurJour, hauteur).strokeColor('#cbd5e1').lineWidth(0.5).stroke();

        const duJour = creneaux.filter((c) => {
          if (Number(c.jour_semaine) !== jour) return false;
          const debut = horaires.enMinutes(String(c.heure_debut).slice(0, 5));
          return debut >= ligne.debut && debut < ligne.fin;
        });
        for (const creneau of duJour) {
          const place = placerCreneau(lignes, creneau);
          if (!place || place.depart !== lignes.indexOf(ligne)) continue;
          const hauteurCreneau = (place.finIndex - place.depart + 1) * HAUTEUR_LIGNE;
          doc.rect(x + 1, y + 1, largeurJour - 2, hauteurCreneau - 2).fill('#eff6ff');
          doc.rect(x + 1, y + 1, 2.5, hauteurCreneau - 2).fill('#1d4ed8');
          let curseur = y + 4;
          doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(7.5)
            .text(creneau.matiere_nom || '', x + 7, curseur, { width: largeurJour - 12, height: 12, ellipsis: true });
          curseur += 10;
          doc.fillColor('#475569').font('Helvetica').fontSize(6.5)
            .text(`${creneau.prof_prenom || ''} ${creneau.prof_nom || ''}`.trim(), x + 7, curseur, { width: largeurJour - 12, height: 10, ellipsis: true });
          if (creneau.salle) {
            curseur += 8;
            doc.fillColor('#1d4ed8').font('Helvetica').fontSize(6)
              .text(`Salle ${creneau.salle}`, x + 7, curseur, { width: largeurJour - 12, height: 9, ellipsis: true });
          }
        }
      }
    }
    y += hauteur;
  }

  doc.moveTo(x0, y).lineTo(x0 + largeur, y).strokeColor('#cbd5e1').lineWidth(1).stroke();
  doc.y = y + 10;
}

async function dessinerPage(doc, { alias, creneaux, regles, primaire, annee, avecBandeau }) {
  if (avecBandeau) {
    const ecole = (await settingsRepo.get()) || {};
    const logo = await pdf.lireCheminLogo();
    pdf.enTete(doc, ecole, logo);
  }
  pdf.titreDocument(
    doc,
    `Emploi du temps — ${alias.nom}`,
    `${alias.cycle_nom || ''} · ${alias.classe_nom || ''} · ${annee?.libelle || ''}`.replace(/^ · | · $/g, '')
  );
  dessinerGrille(doc, { creneaux, regles, primaire });
  doc.fillColor('#64748b').font('Helvetica').fontSize(7.5).text(
    primaire
      ? `Primaire — cours le matin jusqu’à ${regles.finPrimaire} et l’après-midi de ${regles.debutApresMidi} à ${regles.finApresMidi}, durée libre, pause ${regles.pause.debut}–${regles.pause.fin}.`
      : `1 h = ${regles.dureeHeureMinutes} min · pause ${regles.pause.debut}–${regles.pause.fin} · matinée jusqu’à ${regles.finMatin} · retour ${regles.debutApresMidi}–${regles.finApresMidi}.`,
    40, doc.y + 2, { width: doc.page.width - 80 }
  );
}

/** Récupère les aliases demandés + leurs créneaux + les règles horaires. */
async function preparerGroupes({ classAliasId, classeId, cycleId }) {
  const annee = await yearRepo.findCurrent();
  if (!annee) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
  const regles = await horaires.regles();

  let aliases = [];
  if (classAliasId) {
    const alias = await aliasRepo.findById(Number(classAliasId));
    if (!alias) throw ApiError.notFound('Alias introuvable.', 'ALIAS_NOT_FOUND');
    aliases = [alias];
  } else if (classeId) {
    aliases = await aliasRepo.listByClasse(Number(classeId));
  } else if (cycleId) {
    const { rows } = await aliasRepo.list({ cycle_id: Number(cycleId), parPage: 100, page: 1 });
    aliases = rows;
  } else {
    throw ApiError.badRequest('Indiquez un alias, une classe ou un cycle.', 'SELECTION_REQUISE');
  }
  if (!aliases.length) throw ApiError.notFound('Aucun alias trouvé pour cette sélection.', 'AUCUN_ALIAS');

  const groupes = [];
  for (const alias of aliases) {
    const creneaux = await timetableRepo.listByAlias(annee.id, alias.id);
    groupes.push({
      alias,
      creneaux,
      primaire: horaires.estPrimaire(alias.cycle_nom),
      titre: alias.nom,
    });
  }
  return { annee, regles, groupes };
}

/** Génère le PDF (un flux, une page par alias) et le renvoie au client. */
async function genererPdf(res, selection) {
  const { annee, regles, groupes } = await preparerGroupes(selection);
  const titre = groupes.length === 1 ? groupes[0].alias.nom : `${groupes.length} alias`;
  const doc = await pdf.creerDocument(res, `emploi-du-temps-${nettoyerNom(titre)}.pdf`, { paysage: true });
  for (let index = 0; index < groupes.length; index += 1) {
    const groupe = groupes[index];
    if (index > 0) doc.addPage();
    // eslint-disable-next-line no-await-in-loop
    await dessinerPage(doc, { ...groupe, annee, regles, avecBandeau: index > 0 });
  }
  pdf.finaliser(doc);
}

module.exports = { genererPdf, construireLignes };
