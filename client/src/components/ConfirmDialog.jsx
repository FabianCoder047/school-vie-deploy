// Dialogue de confirmation personnalisé (suppression ou action sensible).
// Jamais alert()/confirm() natifs.
import Button from './Button';

const ICONES = {
  danger: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
  ),
  avertissement: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
  ),
  info: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
  ),
};

export default function ConfirmDialog({
  titre,
  message,
  texteConfirmer = 'Confirmer',
  texteAnnuler = 'Annuler',
  type = 'avertissement',
  onConfirmer,
  onAnnuler,
  chargement = false,
}) {
  return (
    <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-label={titre}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-body" style={{ textAlign: 'center', paddingTop: 'var(--espace-6)' }}>
          <div className={`confirm-icone ${type}`} style={{ margin: '0 auto var(--espace-3)' }}>
            {ICONES[type] || ICONES.avertissement}
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{titre}</h3>
          <p style={{ color: 'var(--gris-600)', fontSize: 14 }}>{message}</p>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <Button variant="secondary" onClick={onAnnuler} disabled={chargement}>{texteAnnuler}</Button>
          <Button variant={type === 'danger' ? 'danger' : 'primary'} onClick={onConfirmer} disabled={chargement}>
            {chargement ? 'Traitement…' : texteConfirmer}
          </Button>
        </div>
      </div>
    </div>
  );
}
