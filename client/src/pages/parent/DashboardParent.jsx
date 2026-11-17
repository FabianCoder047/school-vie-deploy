// Espace Parent — tableau de bord : ses enfants + derniers messages
// (scolarité/relances, absences/retards, communiqués).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import Badge from '../../components/Badge';
import Card from '../../components/Card';
import { IconCash, IconAlert, IconMessage, IconStudent } from '../../layouts/sidebarIcons';

const TYPE_LIB = { SCOLARITE: 'Scolarité', RELANCE: 'Relance', ABSENCE: 'Absence', RETARD: 'Retard' };

export default function DashboardParent() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get('/parent/dashboard').then(({ data }) => setDonnees(data)).catch(() => setErreur('Impossible de charger votre espace.'));
  }, []);

  if (erreur) return <div className="auth-erreur" role="alert">{erreur}</div>;
  if (!donnees) {
    return (
      <>
        <h1 className="page-titre">Espace Parent</h1>
        <div className="spinner" />
      </>
    );
  }

  const { enfants, annee, scolarite, absences, communiques } = donnees;

  return (
    <>
      <h1 className="page-titre">Espace Parent</h1>
      {annee && <p className="text-doux mb-4">Année académique courante : <strong>{annee.libelle}</strong></p>}

      {enfants.length === 0 ? (
        <Card><p className="text-doux">Aucun enfant inscrit cette année. Contactez le secrétariat de l’établissement.</p></Card>
      ) : (
        <>
          {/* ===== Mes enfants ===== */}
          <div className="grid-3 mb-6">
            {enfants.map((e) => (
              <Card key={e.enrollment_id}>
                <div className="flex gap-3" style={{ alignItems: 'center' }}>
                  <Avatar nom={e.nom} prenom={e.prenom} />
                  <div>
                    <div style={{ fontWeight: 800 }}>{e.prenom} {e.nom}</div>
                    <div className="text-doux" style={{ fontSize: 12 }}>{e.matricule}</div>
                    <Badge couleur="bleu" >{e.classe_nom} · {e.alias_nom}</Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
                  <Link className="btn btn-primary btn-sm" to={`/parent/notes?enfant=${e.enrollment_id}`}>Notes</Link>
                  <Link className="btn btn-outline btn-sm" to={`/parent/edt?enfant=${e.enrollment_id}`}>Emploi du temps</Link>
                  <Link className="btn btn-secondary btn-sm" to={`/parent/finance?enfant=${e.enrollment_id}`}>Situation</Link>
                </div>
              </Card>
            ))}
          </div>

          {/* ===== Messages récents ===== */}
          <div className="grid-3" style={{ alignItems: 'start' }}>
            <SectionMessages
              titre="Scolarité & relances"
              icone={<IconCash />}
              tonalite="vert"
              items={scolarite}
              typeLib={{ SCOLARITE: 'Scolarité', RELANCE: 'Relance' }}
              typeCouleur={{ SCOLARITE: 'vert', RELANCE: 'jaune' }}
              vide="Aucune relance ou message de scolarité."
            />
            <SectionMessages
              titre="Absences & retards"
              icone={<IconAlert />}
              tonalite="rouge"
              items={absences}
              typeLib={TYPE_LIB}
              typeCouleur={{ SCOLARITE: 'vert', ABSENCE: 'rouge', RETARD: 'jaune' }}
              vide="Aucune absence ni retard signalé."
            />
            <SectionMessages
              titre="Communiqués de l’administration"
              icone={<IconMessage />}
              tonalite="bleu"
              items={communiques}
              typeLib={{ COMMUNIQUE: 'Communiqué' }}
              typeCouleur={{ COMMUNIQUE: 'bleu' }}
              vide="Aucun communiqué pour l’instant."
            />
          </div>
        </>
      )}
    </>
  );
}

function Avatar({ nom, prenom }) {
  const style = {
    width: 56, height: 56, borderRadius: 'var(--rayon-md)',
    background: 'var(--bleu-100)', color: 'var(--bleu-800)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 18, flexShrink: 0,
  };
  return <div style={style} aria-hidden="true">{(prenom?.[0] || '?').toUpperCase()}{(nom?.[0] || '').toUpperCase()}</div>;
}

function SectionMessages({ titre, icone, tonalite, items, typeLib, typeCouleur, vide }) {
  return (
    <Card titre={titre}>
      {items.length === 0 ? (
        <p className="text-doux">{vide}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((n) => (
            <li key={n.id} style={{ padding: 'var(--espace-3) 0', borderBottom: '1px solid var(--gris-100)' }}>
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                <Badge couleur={typeCouleur[n.type] || 'gris'}>{typeLib[n.type] || n.type}</Badge>
                <span className="text-doux" style={{ fontSize: 11, marginLeft: 'auto' }}>{new Date(n.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>{n.titre}</div>
              <div className="text-doux" style={{ fontSize: 12 }}>{n.message}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
