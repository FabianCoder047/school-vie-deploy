// Page claire pour les modules livrés dans un sprint ultérieur.
import { Link, useSearchParams } from 'react-router-dom';
import Card from '../components/Card';

export default function EnConstructionPage() {
  const [searchParams] = useSearchParams();
  const titre = searchParams.get('titre') || 'Ce module';
  const sprint = searchParams.get('sprint') || 'un prochain sprint';

  return (
    <>
      <h1 className="page-titre">{titre}</h1>
      <Card>
        <div className="etat-vide">
          <div className="etat-vide-icone" aria-hidden="true">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2 2 0 0 1-2.83-2.83l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--gris-800)', marginBottom: 8 }}>{titre} arrive avec le {sprint}</h2>
          <p style={{ maxWidth: 520, margin: '0 auto 16px' }}>
            Ce module fait partie du plan de livraison sprint par sprint. Il sera activé dès que sa livraison sera validée.
          </p>
          <Link to="/" className="btn btn-primary">Retour au tableau de bord</Link>
        </div>
      </Card>
    </>
  );
}
