// Rang au format français : « 1er », « 2ème »… (jamais « 1/54 »).

/** « 1er », « 2ème », « 3ème »… ; null/undefined/NaN → « — ». */
function formatRang(rang) {
  if (rang === null || rang === undefined) return '—';
  const n = Math.floor(Number(rang));
  if (!Number.isFinite(n) || n < 1) return '—';
  return n === 1 ? '1er' : `${n}ème`;
}

module.exports = { formatRang };
