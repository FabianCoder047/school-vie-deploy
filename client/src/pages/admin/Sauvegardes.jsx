// Sauvegardes de l'école — export JSON ou SQL en un clic (téléchargement
// direct, jamais conservé sur le serveur) + restauration contrôlée.
import { useEffect, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Select from '../../components/Select';

export default function SauvegardesPage() {
  const toast = useToast();
  const { confirmer } = useConfirm();
  const [annees, setAnnees] = useState([]);
  const [anneeId, setAnneeId] = useState('');
  const [format, setFormat] = useState('JSON');
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [sauvegardes, setSauvegardes] = useState([]);
  const [fichier, setFichier] = useState(null);
  const [restaurationEnCours, setRestaurationEnCours] = useState(false);
  const [motConfirmation, setMotConfirmation] = useState('');

  const recharger = () => {
    setChargement(true);
    api.get('/admin/sauvegardes')
      .then(({ data }) => setSauvegardes(data || []))
      .catch(() => setSauvegardes([]))
      .finally(() => setChargement(false));
  };

  useEffect(() => {
    api.get('/annees-academiques/toutes').then(({ data }) => {
      setAnnees(data || []);
      if (data?.length > 0) setAnneeId(String(data.find((a) => a.is_current)?.id || data[0].id));
    }).catch(() => setAnnees([]));
    recharger();
  }, []);

  const exporter = async () => {
    setEnvoi(true);
    try {
      const response = await api.post('/admin/sauvegardes', { academic_year_id: Number(anneeId), format }, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: format === 'SQL' ? 'application/sql' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const dispo = response.headers?.['content-disposition'] || '';
      const match = /filename="?([^";]+)"?/i.exec(dispo);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] || `sauvegarde.${format === 'SQL' ? 'sql' : 'json'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.succes('Sauvegarde téléchargée.');
      recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Export impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const restaurer = async () => {
    if (!fichier) { toast.avertissement('Choisissez le fichier JSON de sauvegarde.'); return; }
    if (motConfirmation !== 'RESTAURER') { toast.avertissement('Tapez exactement « RESTAURER » pour confirmer.'); return; }
    const ok = await confirmer({
      titre: 'Restaurer la sauvegarde',
      message: 'TOUTES les données métier actuelles seront remplacées par celles du fichier (comptes utilisateurs, audit et notifications préservés). Cette action est irréversible. Continuer ?',
      texteConfirmer: 'Restaurer',
      type: 'danger',
    });
    if (!ok) return;
    const donnees = new FormData();
    donnees.append('sauvegarde', fichier);
    setRestaurationEnCours(true);
    try {
      await api.post('/admin/sauvegardes/restaurer', donnees, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.succes('Restauration terminée. Les comptes utilisateurs ont été préservés.');
      setFichier(null);
      setMotConfirmation('');
      recharger();
    } catch (err) {
      toast.erreur(messageErreur(err, 'Restauration impossible.'));
    } finally {
      setRestaurationEnCours(false);
    }
  };

  const fmtTaille = (octets) => {
    if (!octets) return '—';
    if (octets < 1024) return `${octets} o`;
    if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
    return `${(octets / (1024 * 1024)).toFixed(2)} Mo`;
  };

  return (
    <>
      <h1 className="page-titre">Sauvegardes</h1>
      <p className="text-doux mb-4">Exportez l’ensemble des données métier de l’école — le fichier <strong>est téléchargé directement et jamais conservé sur le serveur</strong>. Trace de chaque export ci-dessous.</p>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* ===== Export ===== */}
        <Card titre="Nouvelle sauvegarde">
          <Select label="Année académique" name="annee" value={anneeId} onChange={(e) => setAnneeId(e.target.value)}>
            {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.is_current ? ' (courante)' : ''}</option>)}
          </Select>
          <div className="mt-4">
            <span className="champ"><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gris-700)' }}>Format</span></span>
            <div className="flex gap-4 mt-4">
              <label className="flex gap-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" name="format" checked={format === 'JSON'} onChange={() => setFormat('JSON')} />
                <span>JSON (restauration possible)</span>
              </label>
              <label className="flex gap-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" name="format" checked={format === 'SQL'} onChange={() => setFormat('SQL')} />
                <span>SQL (lecture/inspection)</span>
              </label>
            </div>
          </div>
          <Button className="mt-6" onClick={exporter} disabled={envoi || !anneeId}>
            {envoi ? 'Génération…' : `Télécharger la sauvegarde (.${format === 'SQL' ? 'sql' : 'json'})`}
          </Button>
          <p className="text-doux mt-4" style={{ fontSize: 12 }}>Contient : cycles, classes, alias, matières, élèves, tuteurs, inscriptions, frais, échéanciers, paiements, notes, emploi du temps, assiduité et séquences. Les comptes utilisateurs et l’audit ne sont PAS inclus.</p>
        </Card>

        {/* ===== Restauration ===== */}
        <Card titre="Restaurer une sauvegarde">
          <div className="auth-erreur" role="alert" style={{ marginBottom: 'var(--espace-4)' }}>
            <strong>Attention.</strong> La restauration <u>remplace toutes les données métier</u> par le contenu du fichier. Les comptes (connexions) et les traces d’audit sont préservés.
          </div>
          <label className="champ" style={{ display: 'block' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gris-700)' }}>Fichier JSON de sauvegarde</span>
            <input type="file" accept="application/json,.json" onChange={(e) => { setFichier(e.target.files?.[0] || null); setMotConfirmation(''); }} />
          </label>
          {fichier && <p className="text-doux mt-4" style={{ fontSize: 12 }}>Fichier choisi : <strong>{fichier.name}</strong> ({(fichier.size / 1024).toFixed(1)} Ko)</p>}
          <div className="mt-4">
            <label className="champ" htmlFor="mot-confirmation">Tapez <strong>RESTAURER</strong> pour confirmer</label>
            <input id="mot-confirmation" type="text" value={motConfirmation} onChange={(e) => setMotConfirmation(e.target.value)} placeholder="RESTAURER" autoComplete="off" style={{ padding: '10px 12px', border: '1px solid var(--bordure)', borderRadius: 'var(--rayon-md)' }} />
          </div>
          <Button variant="danger" className="mt-4" onClick={restaurer} disabled={restaurationEnCours || !fichier || motConfirmation !== 'RESTAURER'}>
            {restaurationEnCours ? 'Restauration…' : 'Restaurer'}
          </Button>
        </Card>
      </div>

      {/* ===== Historique ===== */}
      <Card titre="Sauvegardes précédentes" className="mt-4">
        {chargement ? (
          <div className="spinner" />
        ) : sauvegardes.length === 0 ? (
          <p className="text-doux">Aucune sauvegarde enregistrée.</p>
        ) : (
          <div className="table-conteneur">
            <table className="tableau" style={{ minWidth: 600 }}>
              <thead>
                <tr><th>Date</th><th>Année</th><th>Format</th><th>Taille</th><th>Par</th></tr>
              </thead>
              <tbody>
                {sauvegardes.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{s.annee_libelle}</td>
                    <td>{s.format}</td>
                    <td>{fmtTaille(s.taille_octets)}</td>
                    <td>{s.cree_par}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
