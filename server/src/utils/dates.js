// Normalisation de dates en 'YYYY-MM-DD' (colonnes DATE/DATETIME mysql2,
// chaînes ISO, Dates natives) — pour comparaisons lexicographiques sûres.

/** 'YYYY-MM-DD' à partir d'une Date, d'une chaîne ISO ou d'un objet mysql2 DATE. */
function ymd(d) {
  if (!d) return '9999-12-31';
  if (d instanceof Date) {
    if (Number.isNaN(d.getTime())) return '9999-12-31';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const brut = String(d);
  // Déjà au format ISO ou proche (YYYY-MM-DD[…]) ?
  const m = brut.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = new Date(brut);
  if (Number.isNaN(t.getTime())) return '9999-12-31';
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** 'YYYY-MM-DD' de la date du jour (locale serveur). */
function aujourdHuiYmd() {
  return ymd(new Date());
}

module.exports = { ymd, aujourdHuiYmd };
