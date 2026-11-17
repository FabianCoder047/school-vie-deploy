// Génération de l'échéancier de scolarité selon la modalité de paiement.
// Montants en centimes (entiers) pour éviter tout flottant ; DECIMAL à l'écriture.
//
// Année académique : 1er septembre → 30 juin. La rentrée (septembre) est réglée
// avec les frais d'inscription ; la scolarité est réglée en 9 mensualités.
// JOURNALIER  : chaque jour ouvré (lun–ven) de l'année scolaire
// HEBDOMADAIRE: chaque lundi
// MENSUEL     : le 1er de chaque mois, d'octobre à juin → 9 échéances
// TRIMESTRIEL : le 1er d'octobre, de janvier et d'avril → 3 échéances de 3 mois
// SEMESTRIEL  : le 1er d'octobre puis le 1er de mars → 2 échéances de 5 mois puis 4 mois
//               (montants répartis moitié / moitié)

// mysql2 renvoie les colonnes DATE comme des objets Date : on accepte les deux.
function parseDate(iso) {
  if (iso instanceof Date) {
    return new Date(Date.UTC(iso.getUTCFullYear(), iso.getUTCMonth(), iso.getUTCDate()));
  }
  const [a, m, j] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, (m || 1) - 1, j || 1));
}

function versIso(date) {
  return date.toISOString().slice(0, 10);
}

function* joursEntre(debut, fin) {
  const d = parseDate(debut);
  const f = parseDate(fin);
  const cur = new Date(d);
  while (cur <= f) {
    yield new Date(cur);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

function genererDates(modalite, dateDebut, dateFin) {
  const debut = parseDate(dateDebut);
  const fin = parseDate(dateFin);
  const dates = [];
  if (modalite === 'JOURNALIER' || modalite === 'HEBDOMADAIRE') {
    for (const jour of joursEntre(dateDebut, dateFin)) {
      const semaine = jour.getUTCDay(); // 0=dimanche, 1=lundi...
      if (modalite === 'JOURNALIER' && semaine >= 1 && semaine <= 5) dates.push(versIso(jour));
      if (modalite === 'HEBDOMADAIRE' && semaine === 1) dates.push(versIso(jour));
    }
  } else if (modalite === 'MENSUEL') {
    // Le 1er de chaque mois, à partir du mois suivant la rentrée (octobre), jusqu'à la fin d'année (juin).
    const finAbs = fin.getUTCFullYear() * 12 + fin.getUTCMonth();
    let moisAbs = debut.getUTCFullYear() * 12 + debut.getUTCMonth() + 1; // octobre
    while (moisAbs <= finAbs) {
      const annee = Math.floor(moisAbs / 12);
      const mois = moisAbs % 12;
      dates.push(versIso(new Date(Date.UTC(annee, mois, 1))));
      moisAbs += 1;
    }
  } else if (modalite === 'TRIMESTRIEL' || modalite === 'SEMESTRIEL') {
    // Oct. / Janv. / Avr. (trimestriel) — ou Oct. / Mars (semestriel : 5 mois puis 4 mois).
    const moisAbs = debut.getUTCFullYear() * 12 + debut.getUTCMonth();
    const offsets = modalite === 'TRIMESTRIEL' ? [1, 4, 7] : [1, 6];
    for (const decalage of offsets) {
      const annee = Math.floor((moisAbs + decalage) / 12);
      const mois = (moisAbs + decalage) % 12;
      const d = new Date(Date.UTC(annee, mois, 1));
      if (d >= debut && d <= fin) dates.push(versIso(d));
    }
  }
  return [...new Set(dates)].sort();
}

/**
 * Répartit `montantCentimes` sur `n` échéances (dernière = ajustement).
 * @returns {Array<{ numero: number, date_echeance: string, montant_du: string }>}
 */
function repartirMontant(montantCentimes, dates) {
  const n = dates.length;
  const base = Math.floor(montantCentimes / n);
  const reste = montantCentimes - base * n;
  return dates.map((date_echeance, index) => {
    const centimes = index === n - 1 ? base + reste : base;
    return { numero: index + 1, date_echeance, montant_du: (centimes / 100).toFixed(2) };
  });
}

/**
 * Convertit un montant DECIMAL/chaîne (« 125000.00 ») en centimes (entier).
 */
function versCentimes(montant) {
  const [entier, dec = '00'] = String(montant == null ? '0' : montant).split('.');
  return Math.abs(Number(entier || 0)) * 100 + Number((dec + '00').slice(0, 2));
}

/**
 * Génère l'échéancier complet.
 * @param {{ modalite: string, montantScolarite: string|number, dateDebut: string, dateFin: string }} params
 */
function genererEcheancier({ modalite, montantScolarite, dateDebut, dateFin }) {
  const dates = genererDates(modalite, dateDebut, dateFin);
  if (dates.length === 0) {
    throw new Error(`Aucun créneau d'échéance pour la modalité ${modalite} sur la période ${dateDebut} → ${dateFin}.`);
  }
  return repartirMontant(versCentimes(montantScolarite), dates);
}

module.exports = { genererEcheancier, genererDates, versCentimes };
