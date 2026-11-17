// Lien wa.me (WhatsApp sans API payante) : message pré-rempli.
// Les numéros locaux togolais (8 chiffres, ex. 90 00 00 00) sont préfixés
// par l'indicatif PHONE_COUNTRY_CODE (défaut 228).
const PAYS = process.env.PHONE_COUNTRY_CODE || '228';

/** Normalise un numéro en format international sans « + » (wa.me). */
function normaliserTelephoneWa(numero) {
  const chiffres = String(numero || '').replace(/[^\d]/g, '');
  if (!chiffres) return '';
  if (chiffres.startsWith('00')) return chiffres.slice(2);
  if (chiffres.startsWith(PAYS)) return chiffres;
  if (chiffres.startsWith('0')) return PAYS + chiffres.slice(1);
  if (chiffres.length === 8) return PAYS + chiffres; // numéro local sans 0
  return chiffres;
}

/** wa.me/<numéro>?text=<message encodé> */
function waLink(numero, message) {
  const tel = normaliserTelephoneWa(numero);
  return `https://wa.me/${tel}?text=${encodeURIComponent(message)}`;
}

module.exports = { waLink, normaliserTelephoneWa };
