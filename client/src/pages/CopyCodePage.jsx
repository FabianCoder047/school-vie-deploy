// Page ouverte par le lien « Copier » du mail d'identifiants.
// Le mot de passe est récupéré via un jeton signé de courte durée, puis
// affiché avec un vrai bouton « Copier » (presse-papiers du navigateur).
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { messageErreur } from '../api/axios';
import Card from '../components/Card';
import Button from '../components/Button';
import CodeCopiable from '../components/CodeCopiable';
import SchoolLogo from '../components/SchoolLogo';
import PwaInstallBanner from '../components/PwaInstallBanner';

export default function CopyCodePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [code, setCode] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!token) { setErreur('Lien de copie invalide.'); return; }
    api.get('/auth/copy-code', { params: { token } })
      .then(({ data }) => setCode(data.password))
      .catch((e) => setErreur(messageErreur(e, 'Lien invalide ou expiré.')));
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-layout" style={{ gridTemplateColumns: '1fr', maxWidth: 620, minHeight: 0 }}>
        <main className="auth-formulaire">
          <Card>
            <div style={{ textAlign: 'center' }}>
              <SchoolLogo className="auth-logo" />
              <h1 className="auth-titre" style={{ fontSize: 22 }}>Votre mot de passe provisoire</h1>
              <p className="auth-sous-titre">Cliquez sur « Copier » pour le coller dans le formulaire de connexion.</p>
            </div>

            {erreur && <div className="auth-erreur mt-4" role="alert">{erreur}</div>}
            {!code && !erreur && <div className="spinner" style={{ margin: '24px auto' }} />}
            {code && (
              <div className="mt-6" style={{ textAlign: 'center' }}>
                <CodeCopiable valeur={code} />
              </div>
            )}

            <div className="mt-6" style={{ textAlign: 'center' }}>
              <Link to="/connexion"><Button variant="secondary">Aller à la connexion</Button></Link>
            </div>
          </Card>
        </main>
      </div>
      <PwaInstallBanner />
    </div>
  );
}
