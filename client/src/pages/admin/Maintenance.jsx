// Maintenance — l'administrateur définit ici la fenêtre pendant laquelle
// le site est inactif pour TOUS, sauf pour lui-même. La fin de la fenêtre
// met fin à la maintenance automatiquement (aucun redémarrage nécessaire).
import { useCallback, useEffect, useState } from 'react';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { useMaintenance } from '../../context/MaintenanceContext';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Textarea from '../../components/Textarea';
import Badge from '../../components/Badge';
import { IconMaintenance } from '../../layouts/sidebarIcons';

const versInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const dateFr = (iso) => new Date(iso).toLocaleString('fr-FR', {
  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function MaintenancePage() {
  const toast = useToast();
  const { confirmer } = useConfirm();
  const { verifier: verifierGlobale } = useMaintenance();

  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ debut: '', fin: '', message: '' });
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [arret, setArret] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(() => {
    return api.get('/admin/maintenance')
      .then(({ data }) => {
        setConfig(data);
        setForm({ debut: versInput(data.debut), fin: versInput(data.fin), message: data.message || '' });
      })
      .catch(() => setErreur('Chargement de la configuration impossible.'))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Après toute écriture : recharge la config LOCALE et l'état GLOBAL (bannière, page de garde).
  const apresEcriture = useCallback(async () => {
    await charger();
    await verifierGlobale();
  }, [charger, verifierGlobale]);

  const appliquerPreset = (type) => {
    const maintenant = new Date();
    const d = new Date(maintenant);
    let f;
    if (type === 'maintenant') {
      d.setMinutes(d.getMinutes() + 1);
      f = new Date(d.getTime() + 2 * 3600 * 1000);
    } else if (type === 'ce-soir') {
      d.setHours(22, 0, 0, 0);
      if (d <= maintenant) d.setDate(d.getDate() + 1);
      f = new Date(d.getTime() + 4 * 3600 * 1000);
    } else { // demain matin
      d.setDate(d.getDate() + 1);
      d.setHours(5, 0, 0, 0);
      f = new Date(d.getTime() + 3 * 3600 * 1000);
    }
    setForm((precedent) => ({ ...precedent, debut: versInput(d.toISOString()), fin: versInput(f.toISOString()) }));
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!form.debut || !form.fin) {
      setErreur('Indiquez le début et la fin de la période de maintenance.');
      return;
    }
    if (new Date(form.fin) <= new Date(form.debut)) {
      setErreur('La fin doit être postérieure au début.');
      return;
    }
    setEnvoi(true);
    try {
      await api.put('/admin/maintenance', {
        debut: new Date(form.debut).toISOString(),
        fin: new Date(form.fin).toISOString(),
        message: form.message.trim() || null,
      });
      toast.succes('Période de maintenance enregistrée.');
      await apresEcriture();
    } catch (err) {
      setErreur(messageErreur(err, 'Enregistrement impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  const terminer = async () => {
    const ok = await confirmer({
      titre: 'Terminer la maintenance',
      message: 'La maintenance sera arrêtée immédiatement : le site redeviendra accessible à tous les utilisateurs. Continuer ?',
      texteConfirmer: 'Terminer maintenant',
      type: 'avertissement',
    });
    if (!ok) return;
    setArret(true);
    setErreur('');
    try {
      await api.post('/admin/maintenance/terminer');
      toast.succes('Maintenance terminée — le site est de nouveau accessible.');
      await apresEcriture();
    } catch (err) {
      setErreur(messageErreur(err, 'Impossible de terminer la maintenance.'));
    } finally {
      setArret(false);
    }
  };

  if (chargement) return <div className="spinner" aria-label="Chargement…" />;

  const estActive = config?.etat === 'active';
  const estPlanifiee = config?.etat === 'planifiee';

  return (
    <div>
      <h1 className="page-titre">Maintenance du site</h1>

      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      <div style={{ display: 'grid', gap: 'var(--espace-4)', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {/* État actuel */}
        <Card titre="État actuel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', marginBottom: 'var(--espace-4)' }}>
            <IconMaintenance />
            {estActive && <Badge couleur="rouge">Maintenance en cours</Badge>}
            {estPlanifiee && <Badge couleur="jaune">Planifiée</Badge>}
            {!estActive && !estPlanifiee && <Badge couleur="vert">Site accessible</Badge>}
          </div>

          {estActive || estPlanifiee ? (
            <div style={{ display: 'grid', gap: 'var(--espace-3)', fontSize: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--gris-500)', marginBottom: 2 }}>Début</div>
                <div>{dateFr(config.debut)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--gris-500)', marginBottom: 2 }}>Fin prévue</div>
                <div>{dateFr(config.fin)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--gris-500)', marginBottom: 2 }}>Message affiché aux utilisateurs</div>
                <div>{config.message}</div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--gris-500)', lineHeight: 1.5 }}>
                Pendant cette période, le site est inactif pour <strong>tous les utilisateurs sauf l’administrateur</strong>.
                La maintenance s’arrête automatiquement à la fin prévue.
              </p>
              <Button variant="danger" onClick={terminer} disabled={arret}>
                {arret ? 'Arrêt en cours…' : 'Terminer la maintenance maintenant'}
              </Button>
            </div>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--gris-500)', lineHeight: 1.6 }}>
              Aucune période de maintenance n’est définie. Le site est accessible à tous les utilisateurs.
              Définissez une période ci-contre quand vous devez intervenir sur le site — les utilisateurs
              verront une page d’attente pendant ce temps.
            </p>
          )}
        </Card>

        {/* Définir / modifier la période */}
        <Card titre="Définir une période de maintenance">
          <form onSubmit={enregistrer} style={{ display: 'grid', gap: 'var(--espace-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => appliquerPreset('maintenant')}>Maintenant → +2 h</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => appliquerPreset('ce-soir')}>Ce soir 22 h → +4 h</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => appliquerPreset('demain')}>Demain 5 h → +3 h</Button>
            </div>

            <Input
              label="Début de la maintenance"
              type="datetime-local"
              value={form.debut}
              onChange={(e) => setForm((f) => ({ ...f, debut: e.target.value }))}
              requis
            />
            <Input
              label="Fin de la maintenance"
              type="datetime-local"
              value={form.fin}
              onChange={(e) => setForm((f) => ({ ...f, fin: e.target.value }))}
              aide="La maintenance s’arrête toute seule à cette date — le site redevient accessible automatiquement."
              requis
            />
            <Textarea
              label="Message affiché aux utilisateurs (facultatif)"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              rows={3}
              maxLength={255}
              placeholder="Le site est en cours de maintenance…"
              aide={`${form.message.length}/255 caractères`}
            />

            <Button type="submit" variant="primary" disabled={envoi}>
              {envoi ? 'Enregistrement…' : 'Enregistrer la période'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
