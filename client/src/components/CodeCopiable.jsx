// Code (mot de passe provisoire) avec un vrai bouton « Copier ».
import { useState } from 'react';

async function ecrireDansPressePapiers(texte) {
  // API moderne (HTTPS, navigateurs récents)
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch (_err) { /* on tente le fallback ci-dessous */ }

  // Fallback pour Safari iOS / Firefox / contextes non sécurisés
  try {
    const zone = document.createElement('textarea');
    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.position = 'fixed';
    zone.style.top = '0';
    zone.style.left = '-9999px';
    document.body.appendChild(zone);
    zone.select();
    zone.setSelectionRange(0, zone.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(zone);
    return ok;
  } catch (_err) {
    return false;
  }
}

export default function CodeCopiable({ valeur }) {
  const [etat, setEtat] = useState('copier'); // 'copier' | 'copie' | 'manuel'

  const copier = async () => {
    const ok = await ecrireDansPressePapiers(valeur);
    setEtat(ok ? 'copie' : 'manuel');
    window.setTimeout(() => setEtat('copier'), 2500);
  };

  return (
    <span className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <code style={{ background: '#fff', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--bordure)', fontSize: 15, fontWeight: 700, letterSpacing: 1, userSelect: 'all' }}>
        {valeur}
      </code>
      <button type="button" className="btn btn-secondary btn-sm" onClick={copier}>
        {etat === 'copie' ? '✓ Copié !' : etat === 'manuel' ? 'Sélectionnez le code' : 'Copier'}
      </button>
    </span>
  );
}
