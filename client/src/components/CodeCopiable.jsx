// Code (mot de passe provisoire) sélectionnable d'un clic + bouton « Copier ».
import { useState } from 'react';

export default function CodeCopiable({ valeur }) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch (_err) {
      // navigator.clipboard indisponible (HTTP/navigateur ancien) : on
      // sélectionne le texte pour que l'utilisateur copie manuellement.
      const selection = window.getSelection();
      const plage = document.createRange();
      plage.selectNodeContents(document.getElementById(`code-${valeur}`));
      selection.removeAllRanges();
      selection.addRange(plage);
    }
  };

  return (
    <span className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <code id={`code-${valeur}`}
        style={{ background: '#fff', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--bordure)', fontSize: 15, fontWeight: 700, letterSpacing: 1, userSelect: 'all' }}>
        {valeur}
      </code>
      <button type="button" className="btn btn-secondary btn-sm" onClick={copier}>
        {copie ? '✓ Copié !' : 'Copier'}
      </button>
    </span>
  );
}
