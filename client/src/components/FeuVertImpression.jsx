// Feu vert du directeur — autorisation (permanente, activable/désactivable)
// d'impression des cartes scolaires, bulletins ou emplois du temps PAR LA SECRÉTAIRE.
// Visible uniquement du directeur, sur les écrans Cartes / Bulletins.
import { useEffect, useState } from 'react';
import api, { messageErreur } from '../api/axios';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import Card from './Card';
import Button from './Button';
import Badge from './Badge';

/**
 * @param {{ type: 'cartes' | 'bulletins' | 'edts' }} props
 * Émet l'événement window 'feu-vert-change' (detail: {type, autorisee}) pour que
 * les pages partagées se resynchronisent sans rechargement.
 */
export default function FeuVertImpression({ type }) {
  const toast = useToast();
  const { confirmer } = useConfirm();
  const [actif, setActif] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  const estCartes = type === 'cartes';
  const estEdts = type === 'edts';
  const libelle = estCartes ? 'cartes scolaires' : (estEdts ? 'emplois du temps' : 'bulletins');
  const colonne = estCartes ? 'cartes_impression_autorisee' : (estEdts ? 'edts_impression_autorisee' : 'bulletins_impression_autorisee');

  useEffect(() => {
    let actif = true;
    api.get('/parametres')
      .then(({ data }) => { if (actif) setActif(Boolean(data?.[colonne])); })
      .catch(() => {})
      .finally(() => actif && setChargement(false));
    return () => { actif = false; };
  }, [colonne]);

  const basculer = async () => {
    const cible = !actif;
    if (!cible) {
      const ok = await confirmer({
        titre: 'Révoquer le feu vert',
        message: `La secrétaire ne pourra plus imprimer les ${libelle} tant que vous ne réactiverez pas l’autorisation. Continuer ?`,
        texteConfirmer: 'Révoquer',
        type: 'danger',
      });
      if (!ok) return;
    }
    setEnvoi(true);
    try {
      const { data } = await api.put(`/directeur/impressions/${type}`, { autorisee: cible });
      const flag = Boolean(data?.parametres?.[colonne]);
      setActif(flag);
      window.dispatchEvent(new CustomEvent('feu-vert-change', { detail: { type, autorisee: flag } }));
      toast.succes(flag
        ? `Feu vert accordé — la secrétaire peut imprimer les ${libelle}.`
        : `Feu vert révoqué — l’impression des ${libelle} est bloquée pour la secrétaire.`);
    } catch (err) {
      toast.erreur(messageErreur(err, 'Mise à jour impossible.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Card className="mb-4">
      <div className="flex-between gap-3" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div className="flex gap-3" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>Feu vert secrétaire — impression des {libelle}</strong>
            {!chargement && <Badge couleur={actif ? 'vert' : 'rouge'}>{actif ? 'Autorisée' : 'Non autorisée'}</Badge>}
          </div>
          <p className="text-doux mt-4" style={{ fontSize: 13 }}>
            {actif
              ? 'La secrétaire peut imprimer ces documents (vous conservez vous-même l’accès complet).'
              : 'La secrétaire voit les écrans mais ne peut pas générer les PDF tant que le feu vert n’est pas donné.'}
          </p>
        </div>
        <Button variant={actif ? 'secondary' : 'primary'} onClick={basculer} disabled={chargement || envoi}>
          {envoi ? 'Patientez…' : actif ? 'Révoquer le feu vert' : 'Donner le feu vert'}
        </Button>
      </div>
    </Card>
  );
}
