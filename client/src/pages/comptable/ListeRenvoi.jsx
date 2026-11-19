// Liste de renvoi (Comptable) — classe entière, échéances arrêtées à une date.
// Tous les élèves de la classe avec leur statut de paiement ; « Total à régler »
// = échéances dues à la date d'arrêt non couvertes (arriérés inclus).
// Export PDF au format « Liste de renvoi » (signatures Comptable / Directeur).
import { useEffect, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Select from '../../components/Select';
import Input from '../../components/Input';
import ApercuPdf from '../../components/ApercuPdf';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const aujourdHui = () => new Date().toISOString().slice(0, 10);

export default function ListeRenvoiPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [au, setAu] = useState(aujourdHui());
  const [liste, setListe] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [apercuPdf, setApercuPdf] = useState(null); // { url, titre }

  useEffect(() => {
    api.get('/classes/toutes').then(({ data }) => setClasses(data || [])).catch(() => setClasses([]));
  }, []);

  const generer = async () => {
    setErreur('');
    setListe(null);
    if (!classId) { setErreur('Choisissez une classe.'); return; }
    setChargement(true);
    try {
      const params = new URLSearchParams({ class_id: classId });
      if (au) params.set('au', au);
      const { data } = await api.get(`/comptable/liste-renvoi?${params.toString()}`);
      setListe(data);
    } catch (err) {
      setErreur(messageErreur(err, 'Génération impossible.'));
    } finally {
      setChargement(false);
    }
  };

  const apercu = () => {
    setErreur('');
    if (!classId) { setErreur('Choisissez une classe.'); return; }
    const params = new URLSearchParams({ class_id: classId });
    if (au) params.set('au', au);
    const classe = classes.find((c) => String(c.id) === String(classId));
    setApercuPdf({ url: `/comptable/liste-renvoi/pdf?${params.toString()}`, titre: `Liste de renvoi — ${classe?.nom || 'classe'}` });
  };

  return (
    <>
      <h1 className="page-titre">Liste de renvoi</h1>
      <p className="text-doux mb-4">
        Liste des élèves de la classe dont les échéances, arrêtées à une date, ne sont pas réglées.
        « Total à régler » = échéances dues à la date d’arrêt non couvertes (arriérés inclus).
      </p>

      <Card>
        <div className="flex gap-3" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Select label="Classe" name="classe" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">— Choisir une classe —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.cycle_nom ? `${c.cycle_nom} · ` : ''}{c.nom}</option>)}
          </Select>
          <Input label="Échéances arrêtées au" name="au" type="date" value={au} onChange={(e) => setAu(e.target.value)} style={{ minWidth: 170 }} />
          <Button onClick={generer} disabled={chargement}>{chargement ? 'Génération…' : 'Prévisualiser'}</Button>
          <Button variant="secondary" onClick={apercu}>Aperçu / Imprimer (PDF)</Button>
        </div>
        {erreur && <div className="auth-erreur mt-4" role="alert">{erreur}</div>}
      </Card>

      {liste && (
        <>
          <Card className="mt-4">
            <div className="flex-between gap-3" style={{ flexWrap: 'wrap' }}>
              <div>
                <strong>{liste.classe.cycle_nom} · {liste.classe.nom}</strong>
                <span className="text-doux"> — Année {liste.annee.libelle} — Écolage complet : {liste.ecolage_complet != null ? `${fmt(liste.ecolage_complet)} ${liste.devise}` : liste.ecolage_variable ? 'variable (selon les élèves)' : '—'}</span>
              </div>
              <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
                <Badge couleur="bleu">Effectif : {liste.effectif}</Badge>
                <Badge couleur="vert">À jour : {liste.a_jour}</Badge>
                <Badge couleur="rouge">À renvoyer : {liste.a_renvoyer}</Badge>
              </div>
            </div>
            {liste.previsionnelle && (
              <div className="auth-erreur mt-4" role="alert" style={{ background: 'var(--jaune-50, #fffbeb)', color: 'var(--jaune-900, #92400e)' }}>
                La date d’arrêt n’est pas encore atteinte : cette liste est prévisionnelle.
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <div className="table-conteneur">
              <table className="tableau" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Nom &amp; Prénom</th>
                    <th>Payé sur le dû</th>
                    <th>Reste dû</th>
                    <th>Total à régler</th>
                    <th>Total payé</th>
                    <th>Reste écolage</th>
                    <th>Dernier versement</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.lignes.length === 0 ? (
                    <tr><td colSpan={9}><div className="etat-vide">Aucun élève inscrit dans cette classe pour l’année courante.</div></td></tr>
                  ) : liste.lignes.map((l) => (
                    <tr key={l.enrollment_id} style={l.statut === 'A_RENVOYER' ? { background: '#fef2f2' } : undefined}>
                      <td>{l.matricule}</td>
                      <td>{l.nom} {l.prenom}</td>
                      <td>{fmt(l.paye_sur_le_du)}</td>
                      <td>{fmt(l.reste_du)}</td>
                      <td><strong>{fmt(l.total_a_regler)}</strong></td>
                      <td>{fmt(l.total_paye)}</td>
                      <td>{fmt(l.reste_ecolage)}</td>
                      <td>{l.dernier_versement ? new Date(l.dernier_versement).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{l.statut === 'A_JOUR' ? <Badge couleur="vert">À jour</Badge> : <Badge couleur="rouge">À renvoyer</Badge>}</td>
                    </tr>
                  ))}
                  {liste.lignes.length > 0 && (
                    <tr style={{ background: 'var(--bleu-50)', fontWeight: 700 }}>
                      <td colSpan={2}>Total ({liste.lignes.length} élève{liste.lignes.length > 1 ? 's' : ''})</td>
                      <td>{fmt(liste.totaux.paye_sur_le_du)}</td>
                      <td>{fmt(liste.totaux.reste_du)}</td>
                      <td>{fmt(liste.totaux.total_a_regler)}</td>
                      <td>{fmt(liste.totaux.total_paye)}</td>
                      <td>{fmt(liste.totaux.reste_ecolage)}</td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-doux mt-4" style={{ fontSize: 12 }}>
            Versements appliqués par ordre d’échéance. « Total à régler » = échéances dues à la date d’arrêt non couvertes (arriérés inclus) :
            c’est la somme à verser pour être à jour à cette date.
          </p>
        </>
      )}

      {apercuPdf && <ApercuPdf titre={apercuPdf.titre} url={apercuPdf.url} onFermer={() => setApercuPdf(null)} />}
    </>
  );
}
