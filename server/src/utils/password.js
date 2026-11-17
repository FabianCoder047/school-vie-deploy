// Génération cryptographiquement sûre de mots de passe par défaut
// (création de comptes : Directeur, Secrétaire, Comptable, Professeur, Parent).
const crypto = require('crypto');

const LOWER = 'abcdefghijkmnopqrstuvwxyz'; // sans l/o/i ambigus... volontairement simple
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function pick(chars, n) {
  let out = '';
  const bytes = crypto.randomBytes(n);
  for (let i = 0; i < n; i += 1) out += chars[bytes[i] % chars.length];
  return out;
}

/** Mot de passe de 14 caractères avec au moins un caractère de chaque famille. */
function generateDefaultPassword() {
  const raw = [...pick(LOWER, 3), ...pick(UPPER, 3), ...pick(DIGITS, 3), ...pick(SYMBOLS, 2), ...pick(ALL, 3)];
  // Mélange Fisher–Yates avec un CSPRNG pour ne pas exposer la structure.
  for (let i = raw.length - 1; i > 0; i -= 1) {
    const j = crypto.randomBytes(1)[0] % (i + 1);
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  return raw.join('');
}

module.exports = { generateDefaultPassword };
