// Assistante d'inscription en 4 étapes :
//  1) Infos personnelles de l'élève (+ photo optionnelle)
//  2) Informations académiques (cycle → classe → alias, modalité)
//  3) Informations du tuteur
//  4) Récapitulatif → création (matricule + échéancier automatiques)
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { messageErreur } from '../../api/axios';
import { useToast } from '../../hooks/useToast';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Select from '../../components/Select';
import UploadPreuveRecu from '../../components/UploadPreuveRecu';
import CodeCopiable from '../../components/CodeCopiable';

const ETAPES = ['Élève', 'Scolarité', 'Tuteur', 'Récapitulatif'];
const MOYEN_LIB = { ESPECES: 'Espèces', FLOOZ: 'Flooz', MIXX_BY_YAS: 'Mixx By Yas' };

export default function NouvelElevePage({ base = '/secretaire' }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [etape, setEtape] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const [eleve, setEleve] = useState({ nom: '', prenom: '', sexe: '', date_naissance: '', lieu_naissance: '', adresse: '' });
  const [photo, setPhoto] = useState(null);
  const [photoApercu, setPhotoApercu] = useState(null);

  const [annee, setAnnee] = useState(null);
  const [lignesFrais, setLignesFrais] = useState([]); // classes + frais de l'année
  const [cycleId, setCycleId] = useState('');
  const [classId, setClassId] = useState('');
  const [aliasId, setAliasId] = useState('');
  const [modalite, setModalite] = useState('');
  const [aliases, setAliases] = useState([]);

  const [tuteur, setTuteur] = useState({ nom: '', prenom: '', telephone_whatsapp: '', email: '' });
  const [resultat, setResultat] = useState(null);

  const [modalPaiement, setModalPaiement] = useState(false);
  const [paiement, setPaiement] = useState({ moyen: 'ESPECES', reference_transaction: '' });
  const [paiementEnCours, setPaiementEnCours] = useState(false);
  const [paiementErreur, setPaiementErreur] = useState('');
  const [recuId, setRecuId] = useState(null);
  const [preuve, setPreuve] = useState(null);

  useEffect(() => {
    api.get(`${base}/classes-pour-inscription`)
      .then(({ data }) => { setAnnee(data.annee); setLignesFrais(data.lignes || []); })
      .catch(() => setErreur('Impossible de charger les classes et les frais. Vérifiez que le Directeur a défini les frais de scolarité.'));
  }, [base]);

  const cycles = useMemo(() => {
    const map = new Map();
    for (const l of lignesFrais) map.set(l.cycle_id, l.cycle_nom);
    return [...map.entries()].map(([id, nom]) => ({ id, nom }));
  }, [lignesFrais]);

  const classesDuCycle = useMemo(
    () => lignesFrais.filter((l) => String(l.cycle_id) === String(cycleId)),
    [lignesFrais, cycleId]
  );
  const classeChoisie = lignesFrais.find((l) => String(l.class_id) === String(classId)) || null;

  useEffect(() => {
    setAliases([]);
    setAliasId('');
    if (!classId) return;
    api.get(`/alias/classe/${classId}`).then(({ data }) => setAliases(data || [])).catch(() => setAliases([]));
  }, [classId]);

  // Une seule option (la classe entière, quand le Directeur ne définit pas d’alias) → pré-sélectionnée.
  useEffect(() => {
    if (aliases.length === 1) setAliasId(String(aliases[0].id));
  }, [aliases]);

  useEffect(() => { setModalite(''); }, [classId]);

  const choisirPhoto = (e) => {
    const fichier = e.target.files?.[0];
    setPhoto(fichier || null);
    setPhotoApercu((ancien) => {
      if (ancien) URL.revokeObjectURL(ancien);
      return fichier ? URL.createObjectURL(fichier) : null;
    });
  };

  const retirerPhoto = () => {
    setPhoto(null);
    setPhotoApercu((ancien) => {
      if (ancien) URL.revokeObjectURL(ancien);
      return null;
    });
  };

  const etapeValide = [
    // 1 — infos personnelles
    eleve.nom.trim() && eleve.prenom.trim() && eleve.date_naissance && eleve.lieu_naissance.trim() && eleve.adresse.trim(),
    // 2 — scolarité
    cycleId && classId && aliasId && modalite && classeChoisie?.frais_defini !== false && (classeChoisie?.modalites || []).includes(modalite),
    // 3 — tuteur
    tuteur.nom.trim() && tuteur.prenom.trim() && tuteur.telephone_whatsapp.trim(),
    true,
  ];

  const soumettre = async () => {
    setErreur('');
    setEnvoi(true);
    try {
      const { data } = await api.post(`${base}/eleves`, {
        eleve: { ...eleve, nom: eleve.nom.trim(), prenom: eleve.prenom.trim(), lieu_naissance: eleve.lieu_naissance.trim(), adresse: eleve.adresse.trim(), sexe: eleve.sexe || null },
        tuteur: { ...tuteur, nom: tuteur.nom.trim(), prenom: tuteur.prenom.trim(), telephone_whatsapp: tuteur.telephone_whatsapp.trim(), email: tuteur.email.trim() || null },
        academique: { class_id: Number(classId), class_alias_id: Number(aliasId), modalite_paiement: modalite },
      });
      // Photo optionnelle → envoi après création
      if (photo) {
        const donnees = new FormData();
        donnees.append('photo', photo);
        try {
          await api.post(`${base}/eleves/${data.enrollmentId}/photo`, donnees, { headers: { 'Content-Type': 'multipart/form-data' } });
        } catch {
          toast.avertissement('Élève créé, mais la photo n’a pas pu être envoyée.');
        }
      }
      setResultat(data);
      toast.succes('Inscription enregistrée.');
    } catch (err) {
      setErreur(messageErreur(err, 'Inscription impossible.'));
      setEtape(0);
    } finally {
      setEnvoi(false);
    }
  };

  const payerFraisInscription = async (e) => {
    e.preventDefault();
    setPaiementErreur('');
    setPaiementEnCours(true);
    try {
      const { data } = await api.post(`${base}/eleves/${resultat.enrollmentId}/paiement-inscription`, {
        moyen: paiement.moyen,
        reference_transaction: paiement.reference_transaction.trim() || null,
      });
      setRecuId(data.paiement?.id || null);
      setPreuve(data.paiement?.justificatif_chemin ?? null);
      setModalPaiement(false);
      toast.succes('Paiement d’inscription enregistré.');
    } catch (err) {
      setPaiementErreur(messageErreur(err, 'Paiement impossible.'));
    } finally {
      setPaiementEnCours(false);
    }
  };

  const recommencer = () => {
    setResultat(null);
    setEtape(0);
    setEleve({ nom: '', prenom: '', sexe: '', date_naissance: '', lieu_naissance: '', adresse: '' });
    setPhoto(null);
    setPhotoApercu((ancien) => {
      if (ancien) URL.revokeObjectURL(ancien);
      return null;
    });
    setCycleId(''); setClassId(''); setAliasId(''); setModalite('');
    setTuteur({ nom: '', prenom: '', telephone_whatsapp: '', email: '' });
    setRecuId(null);
    setPreuve(null);
    setPaiement({ moyen: 'ESPECES', reference_transaction: '' });
  };

  /* ===== ÉCRAN DE SUCCÈS ===== */
  if (resultat) {
    const p = resultat.compteParent;
    return (
      <>
        <h1 className="page-titre">Inscription terminée</h1>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--espace-4) 0' }}>
            <div className="confirm-icone info" style={{ margin: '0 auto var(--espace-3)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>{eleve.prenom} {eleve.nom} est inscrit(e)</h2>
            <p className="mt-4"><strong>Matricule :</strong> <code style={{ background: 'var(--gris-100)', padding: '2px 10px', borderRadius: 6 }}>{resultat.matricule}</code></p>
            <p className="text-doux mt-4">{resultat.echeances} échéance(s) générée(s) selon la modalité {resultat.frais.modalite} — scolarité figée à {Number(resultat.frais.montant_scolarite).toLocaleString('fr-FR')} FCFA.</p>
          </div>

          {/* Compte parent */}
          <div className="card" style={{ background: 'var(--bleu-50)', border: '1px solid var(--bleu-100)' }}>
            {p?.cree ? (
              <>
                <strong>Compte parent créé</strong> pour {p.telephone}{p.email ? ` / ${p.email}` : ''}.
                {p.motDePasseTemporaire ? (
                  <>
                    <p className="mt-4" style={{ fontSize: 13 }}>Aucun e-mail disponible : transmettez ces identifiants au tuteur (affichés une seule fois) :</p>
                    <p className="mt-4"><strong>Identifiant :</strong> {p.telephone}</p>
                    <p className="mt-4"><strong>Mot de passe :</strong></p>
                    <div className="mt-4"><CodeCopiable valeur={p.motDePasseTemporaire} /></div>
                    <a className="btn btn-success mt-4" href={p.waLink} target="_blank" rel="noopener noreferrer">
                      Envoyer par WhatsApp
                    </a>
                  </>
                ) : (
                  <p className="mt-4" style={{ fontSize: 13 }}>Un e-mail d’identifiants a été envoyé au tuteur.</p>
                )}
              </>
            ) : (
              <p><strong>Compte parent existant</strong> rattaché ({p?.telephone}) — les identifiants habituels restent valables.</p>
            )}
          </div>

          <div className="flex gap-3 mt-6" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {recuId ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                <p className="text-doux" style={{ fontSize: 13 }}>Remettez le reçu rempli à la main. Pour preuve, joignez son scan ci-dessous (« en cas de quoi »).</p>
                <UploadPreuveRecu base={base} paymentId={recuId} preuve={preuve} onChange={setPreuve} />
              </div>
            ) : (
              <Button onClick={() => setModalPaiement(true)}>Marquer le paiement d’inscription</Button>
            )}
            {base === '/secretaire' && <Button variant="secondary" onClick={() => navigate('/secretaire/eleves')}>Voir la fiche élève</Button>}
            <Button variant="ghost" onClick={recommencer}>Inscrire un autre élève</Button>
          </div>
        </Card>

        {modalPaiement && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header"><h3>Paiement des frais d’inscription</h3><button type="button" className="modal-fermer" onClick={() => setModalPaiement(false)} aria-label="Fermer">✕</button></div>
              <form onSubmit={payerFraisInscription}>
                <div className="modal-body">
                  {paiementErreur && <div className="auth-erreur" role="alert">{paiementErreur}</div>}
                  <p className="mb-4"><strong>{Number(resultat.frais.frais_inscription).toLocaleString('fr-FR')} FCFA</strong> à régler.</p>
                  <Select label="Moyen de paiement" name="moyen" value={paiement.moyen} onChange={(e) => setPaiement({ ...paiement, moyen: e.target.value })}>
                    {Object.entries(MOYEN_LIB).map(([code, libelle]) => <option key={code} value={code}>{libelle}</option>)}
                  </Select>
                  <div className="mt-4">
                    <Input label="Référence de transaction (facultatif)" name="reference" value={paiement.reference_transaction} onChange={(e) => setPaiement({ ...paiement, reference_transaction: e.target.value })} placeholder="ex. n° Flooz / Mixx" />
                  </div>
                </div>
                <div className="modal-footer">
                  <Button variant="secondary" type="button" onClick={() => setModalPaiement(false)}>Annuler</Button>
                  <Button type="submit" disabled={paiementEnCours}>{paiementEnCours ? 'Enregistrement…' : 'Enregistrer le paiement'}</Button>
                </div>
              </form>
            </div>
          </div>
        )}

      </>
    );
  }

  /* ===== WIZARD ===== */
  return (
    <>
      <h1 className="page-titre">Inscrire un élève</h1>
      {erreur && <div className="auth-erreur mb-4" role="alert">{erreur}</div>}

      {/* Indicateur d'étapes */}
      <div className="tabs" role="tablist" style={{ marginBottom: 'var(--espace-5)' }}>
        {ETAPES.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`tab ${index === etape ? 'actif' : ''}`}
            onClick={() => index < etape && setEtape(index)}
            aria-current={index === etape ? 'step' : undefined}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {/* ÉTAPE 1 — Élève */}
      {etape === 0 && (
        <Card titre="Informations personnelles">
          <div className="grid-2">
            <Input label="Nom" name="nom" value={eleve.nom} onChange={(e) => setEleve({ ...eleve, nom: e.target.value })} requis autoFocus />
            <Input label="Prénom" name="prenom" value={eleve.prenom} onChange={(e) => setEleve({ ...eleve, prenom: e.target.value })} requis />
          </div>
          <div className="grid-2 mt-4">
            <Select label="Sexe (optionnel)" name="sexe" value={eleve.sexe} onChange={(e) => setEleve({ ...eleve, sexe: e.target.value })}>
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </Select>
            <Input label="Date de naissance" name="date_naissance" type="date" value={eleve.date_naissance} onChange={(e) => setEleve({ ...eleve, date_naissance: e.target.value })} requis />
          </div>
          <div className="mt-4"><Input label="Lieu de naissance" name="lieu_naissance" value={eleve.lieu_naissance} onChange={(e) => setEleve({ ...eleve, lieu_naissance: e.target.value })} requis placeholder="ex. Lomé" /></div>
          <div className="mt-4"><Input label="Adresse du domicile" name="adresse" value={eleve.adresse} onChange={(e) => setEleve({ ...eleve, adresse: e.target.value })} requis placeholder="ex. Quartier Bè, Lomé" /></div>
          <div className="mt-4">
            <span className="champ" style={{ display: 'block', maxWidth: 320 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gris-700)' }}>Photo (optionnelle)</span>
              <span className="flex gap-3 mt-4" style={{ alignItems: 'center' }}>
                <span style={{ width: 64, height: 64, borderRadius: 'var(--rayon-md)', overflow: 'hidden', background: 'var(--gris-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {photoApercu ? <img src={photoApercu} alt="Aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gris-400)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>}
                </span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={choisirPhoto} />
                {photoApercu && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={retirerPhoto} style={{ color: 'var(--rouge-700)' }}>
                    Retirer la photo
                  </button>
                )}
              </span>
            </span>
          </div>
          <div className="flex-between mt-6">
            <span />
            <Button onClick={() => setEtape(1)} disabled={!etapeValide[0]}>Continuer →</Button>
          </div>
        </Card>
      )}

      {/* ÉTAPE 2 — Scolarité */}
      {etape === 1 && (
        <Card titre="Informations académiques">
          {annee && <p className="text-doux mb-4">Année académique courante : <strong>{annee.libelle}</strong> ({new Date(annee.date_debut).toLocaleDateString('fr-FR')} → {new Date(annee.date_fin).toLocaleDateString('fr-FR')})</p>}
          <div className="grid-2">
            <Select label="Cycle" name="cycle" value={cycleId} onChange={(e) => { setCycleId(e.target.value); setClassId(''); }} requis>
              <option value="">— Choisir un cycle —</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Select>
            <Select label="Classe" name="classe" value={classId} onChange={(e) => setClassId(e.target.value)} requis disabled={!cycleId}>
              <option value="">— Choisir une classe —</option>
              {classesDuCycle.map((c) => <option key={c.class_id} value={c.class_id}>{c.classe_nom}{!c.frais_defini ? ' (frais non définis)' : ''}</option>)}
            </Select>
          </div>
          {classId && classeChoisie && !classeChoisie.frais_defini && (
            <div className="auth-erreur mt-4" role="alert">Les frais de scolarité ne sont pas définis pour cette classe. Le Directeur doit les renseigner avant l’inscription.</div>
          )}
          <div className="grid-2 mt-4">
            <Select label="Alias de classe" name="alias" value={aliasId} onChange={(e) => setAliasId(e.target.value)} requis disabled={!classId}
              aide={aliases.length === 1 ? 'Aucune sous-classe définie pour cette classe : l’effectif complet formera un seul groupe.' : undefined}>
              <option value="">— Choisir un alias —</option>
              {aliases.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </Select>
            <Select label="Modalité de paiement" name="modalite" value={modalite} onChange={(e) => setModalite(e.target.value)} requis disabled={!classId || !classeChoisie?.frais_defini}>
              <option value="">— Choisir —</option>
              {(classeChoisie?.modalites || []).map((m) => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
            </Select>
          </div>
          {classeChoisie?.frais_defini && (
            <div className="card mt-4" style={{ background: 'var(--gris-50)' }}>
              <p style={{ fontSize: 13 }}><strong>Frais d’inscription :</strong> {Number(classeChoisie.frais_inscription).toLocaleString('fr-FR')} FCFA</p>
              <p style={{ fontSize: 13 }}><strong>Scolarité annuelle :</strong> {Number(classeChoisie.montant_scolarite).toLocaleString('fr-FR')} FCFA</p>
              <p style={{ fontSize: 12, color: 'var(--texte-doux)' }}>Ces montants seront figés dans l’inscription et ne changeront plus.</p>
            </div>
          )}
          <div className="flex-between mt-6">
            <Button variant="secondary" onClick={() => setEtape(0)}>← Retour</Button>
            <Button onClick={() => setEtape(2)} disabled={!etapeValide[1]}>Continuer →</Button>
          </div>
        </Card>
      )}

      {/* ÉTAPE 3 — Tuteur */}
      {etape === 2 && (
        <Card titre="Informations du tuteur">
          <div className="grid-2">
            <Input label="Nom" name="t_nom" value={tuteur.nom} onChange={(e) => setTuteur({ ...tuteur, nom: e.target.value })} requis autoFocus />
            <Input label="Prénom" name="t_prenom" value={tuteur.prenom} onChange={(e) => setTuteur({ ...tuteur, prenom: e.target.value })} requis />
          </div>
          <div className="mt-4"><Input label="Téléphone WhatsApp" name="t_tel" value={tuteur.telephone_whatsapp} onChange={(e) => setTuteur({ ...tuteur, telephone_whatsapp: e.target.value })} requis placeholder="ex. 90 00 00 00" aide="Sert d’identifiant au compte Parent. Un seul compte parent par famille, quel que soit le nombre d’enfants." /></div>
          <div className="mt-4"><Input label="E-mail (facultatif)" name="t_email" type="email" value={tuteur.email} onChange={(e) => setTuteur({ ...tuteur, email: e.target.value })} placeholder="ex. parent@example.com" aide="Sans e-mail, les identifiants seront affichés une seule fois (avec lien WhatsApp pré-rempli)." /></div>
          <div className="flex-between mt-6">
            <Button variant="secondary" onClick={() => setEtape(1)}>← Retour</Button>
            <Button onClick={() => setEtape(3)} disabled={!etapeValide[2]}>Continuer →</Button>
          </div>
        </Card>
      )}

      {/* ÉTAPE 4 — Récapitulatif */}
      {etape === 3 && (
        <Card titre="Récapitulatif avant inscription">
          <div className="grid-2">
            <div>
              <p style={{ fontSize: 12, color: 'var(--texte-doux)', textTransform: 'uppercase', fontWeight: 700 }}>Élève</p>
              <p className="mt-4"><strong>{eleve.prenom} {eleve.nom}</strong>{eleve.sexe ? ` (${eleve.sexe === 'M' ? 'M' : 'F'})` : ''}</p>
              <p className="text-doux">Né(e) le {new Date(eleve.date_naissance).toLocaleDateString('fr-FR')} à {eleve.lieu_naissance}</p>
              <p className="text-doux">{eleve.adresse}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'var(--texte-doux)', textTransform: 'uppercase', fontWeight: 700 }}>Scolarité</p>
              <p className="mt-4">{classeChoisie?.cycle_nom} — <strong>{classeChoisie?.classe_nom}</strong> · {aliases.find((a) => String(a.id) === String(aliasId))?.nom}</p>
              <p className="text-doux">Modalité : {modalite ? modalite.charAt(0) + modalite.slice(1).toLowerCase() : ''}</p>
              <p className="text-doux">Frais d’inscription : {classeChoisie ? Number(classeChoisie.frais_inscription).toLocaleString('fr-FR') : ''} FCFA — Scolarité : {classeChoisie ? Number(classeChoisie.montant_scolarite).toLocaleString('fr-FR') : ''} FCFA</p>
            </div>
          </div>
          <div className="mt-4">
            <p style={{ fontSize: 12, color: 'var(--texte-doux)', textTransform: 'uppercase', fontWeight: 700 }}>Tuteur</p>
            <p className="mt-4"><strong>{tuteur.prenom} {tuteur.nom}</strong> — {tuteur.telephone_whatsapp}{tuteur.email ? ` — ${tuteur.email}` : ''}</p>
          </div>
          <p className="text-doux mt-4" style={{ fontSize: 12 }}>Un échéancier sera généré automatiquement selon la modalité choisie. Le matricule sera attribué automatiquement.</p>
          <div className="flex-between mt-6">
            <Button variant="secondary" onClick={() => setEtape(2)}>← Retour</Button>
            <Button onClick={soumettre} disabled={envoi}>{envoi ? 'Enregistrement…' : 'Inscrire l’élève'}</Button>
          </div>
        </Card>
      )}
    </>
  );
}
