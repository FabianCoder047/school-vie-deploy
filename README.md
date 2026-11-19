# School Vie — Gestion d'établissement scolaire

Application web complète de gestion d'un établissement scolaire (mono-école) :
administration, direction, vie scolaire, comptabilité, notes et communication avec les parents.

> **État du projet : Sprints 0 et suivants — voir « Avancement ».**
> L'application est livrée sprint par sprint. Chaque sprint est testable de bout en bout.

## Architecture (monorepo)

```
school-app/
├── server/                  # API REST — Node.js ≥ 20 + Express
│   ├── src/
│   │   ├── config/          # env (validation), pool MySQL, transport mail (dry-run)
│   │   ├── database/
│   │   │   ├── migrations/  # 001_init.sql … (versionnées, table schema_migrations)
│   │   │   └── seed.js      # Admin + 1 cycle + 3 classes + année courante + school_settings
│   │   ├── middlewares/     # authenticate, authorizeRoles, requirePasswordChanged, validate, rateLimit, errorHandler
│   │   ├── routes/ controllers/ services/ repositories/
│   │   ├── validators/      # schémas Zod (messages en français)
│   │   ├── templates/       # mails (PDF au Sprint 4)
│   │   └── utils/           # logger, ApiError, mots de passe, séquences (matricules/reçus)
│   └── .env.example         # copier en .env et renseigner (voir ci-dessous)
└── client/                  # SPA — React 18 (Vite) + React Router
    ├── src/
    │   ├── api/             # client Axios (Bearer + auto-refresh sur 401, tokens en mémoire)
    │   ├── components/      # design system (Button, Input, DataTable, Modal, Calendar, …)
    │   ├── layouts/         # DashboardLayout (Sidebar fixe 100vh + Topbar)
    │   ├── context/ hooks/  # AuthContext, ToastContext, ConfirmContext
    │   ├── pages/           # par rôle : admin/, directeur/, … + pages d'auth
    │   ├── routes/          # ProtectedRoute (rôle + mot de passe obligatoire), RoleRedirect
    │   └── styles/          # variables.css (charte bleu/jaune/rouge/vert), base.css, components.css
    └── .env.example
```

Stack : Express (couches routes → controllers → services → repositories) · MySQL (`mysql2/promise`,
requêtes préparées, InnoDB, utf8mb4) · JWT access (15 min) + refresh (7 j, haché SHA-256, rotatif) ·
bcrypt (coût 12) · Zod · helmet · CORS (origine = `CLIENT_URL`) · express-rate-limit · Nodemailer.

## Installation et lancement (développement)

```bash
# 1) Base de données : créer/mettre à jour le schéma
cd server
cp .env.example .env          # puis renseigner DB_PASSWORD, JWT_*, ADMIN_PASSWORD…
npm install
npm run migrate               # 001_init.sql (crée la base school_vie_db_004774 si absente)
npm run seed                  # Admin + Primaire + CP1/CP2/CE1 + année 2026-2027 + school_settings

# 2) API (port 5000)
npm run dev

# 3) Front (port 5173) — dans un autre terminal
cd ../client
npm install
npm run dev
```

Ouvrir http://localhost:5173 → se connecter avec le compte Administrateur lu dans `server/.env`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`). **Le changement de mot de passe est imposé à la 1ère connexion.**

## Comptes et données de départ

Le seed crée UNIQUEMENT :

- l'**Administrateur** (e-mail/mot de passe dans `server/.env`),
- le cycle **Primaire** et les classes **CP1, CP2, CE1**,
- l'**année académique courante** (1er septembre → 30 juin, calculée automatiquement),
- la ligne `school_settings` (id = 1, devise FCFA, notes sur 20, heure = 55 min).

Aucun autre compte n'est créé par le seed : l'Admin crée le Directeur, qui crée les autres comptes.

### Mails en développement

`MAIL_DRY_RUN=true` (défaut dans `.env.example`) : les mails sont **affichés dans la console API**
au lieu d'être envoyés — idéal pour développer sans SMTP. Pour un vrai envoi : renseigner
`SMTP_PASS=<mot-de-passe-d'application-Gmail>` dans `server/.env` (⚠️ jamais commité) et mettre
`MAIL_DRY_RUN=false`.

## Configuration (.env serveur)

Voir `server/.env.example`. Points clés :

| Variable | Rôle |
|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL (base `school_vie_db_004774`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Secrets des tokens (générer : `openssl rand -hex 48`) |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES` | Verrouillage du login (défaut **5 échecs / 30 min**) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Compte Administrateur du seed |
| `SMTP_*`, `MAIL_FROM`, `MAIL_DRY_RUN` | Envoi d'e-mails (Gmail) ou console |
| `RESET_PASSWORD_URL` | Lien de réinitialisation (front) |
| `CLIENT_URL` | Origine autorisée par CORS |

Le front n'a qu'une variable : `VITE_API_URL` (défaut `http://localhost:5000/api`).

## Tests manuels — Sprint 6

```bash
# 1. Comptable → Liste de renvoi : choisir CE1 (8 élèves démo) + une date
#    d'arrêt → Prévisualiser : effectif/à jour/à renvoyer, lignes à renvoyer
#    teintées, totaux ; « Aperçu / Imprimer (PDF) » : PDF au modèle demandé
#    (entête école, LISTE DE RENVOI, signatures LE COMPTABLE / LE DIRECTEUR ;
#    ligne rouge = élèves à renvoyer ; note « prévisionnelle » si la date
#    d'arrêt est dans le futur). Arrêt au 18/11/2026 → À jour : 3, À renvoyer : 5.
# 2. Secrétaire → Emploi du temps / Cartes scolaires / Bulletins / Communiqués :
#    les écrans sont les mêmes que ceux du Directeur (mêmes règles API).
#    - Cartes & bulletins : Tant que le feu vert n'est pas donné → bandeau
#      « Le directeur n'a pas encore donné le feu vert … » + boutons désactivés
#      (API : 403 IMPRESSION_NON_AUTORISEE).
#    - Directeur → Cartes/Bulletins : carte « Feu vert secrétaire » → donner /
#      révoquer. La secrétaire reçoit une notification (cloche) à chaque bascule.
#    - Directeur continue d'imprimer librement.
# 3. Admin → Journal d'activités : toutes les activités (connexion incluse) sont
#    consultables — recherche par auteur, filtres action / entité / période,
#    pagination, détail (avant/après JSON). Générer un PDF (liste de renvoi,
#    bulletins…) y crée une ligne (LISTE_RENVOI, GENERATE_BULLETINS…).
# 4. Communiqués : chaque espace (Admin, Directeur, Secrétaire, Comptable,
#    Professeur, Parent) a l'onglet Communiqués. Le Directeur/Secrétaire/Admin
#    voient tout ; les autres voient les communiqués qui les concernent
#    (TOUS + rôle + portée de leurs classes / élèves). Publication : Directeur
#    et Secrétaire.
# 5. Absences/retards : le professeur enregistre l'appel → chaque nouveau
#    absent/retardataire déclenche une notification interne (cloche + espace
#    Parent → Absences & motifs) + une modale « Notifier les parents par
#    WhatsApp » avec un lien wa.me pré-rempli par tuteur (envoi manuel).
#    Rejouer le même appel ne re-propose rien.
```

## Tests manuels — Sprint 5

```bash
# 1. Administrateur → Sauvegardes : télécharger une sauvegarde JSON (et SQL),
#    vérifier l'historique ; puis « Restaurer » avec RESTAURER tapé + dialog
#    → les données reviennent à l'état du backup, les comptes sont préservés.
# 2. Mon profil (chaque rôle) : modifier prénom/nom/e-mail/téléphone ;
#    changer le mot de passe (mêmes règles front+API).
# 3. Dashboards : vérifier les KPI (Admin : élèves/professeurs/parents/recouvrement ;
#    Directeur : recouvrement/absences/retards ; Secrétaire : inscriptions du mois ;
#    Professeur : absences du mois).
# 4. Revue sécurité : matrice rôle × route (chaque rôle → sa route 200, les autres 403),
#    5 échecs login → 423 pendant 30 min, mot de passe forcé à la 1re connexion,
#    aucune réponse ne contient password_hash.
# 5. Tests automatisés : cd server && npm test (12 tests unitaires + 16 d'intégration).
```

## Tests manuels — Sprint 4

```bash
# PRÉALABLE : Directeur crée Professeur/Secrétaire ; alias ; frais ; affectation ;
# période ouverte ; Secrétaire inscrit des élèves (paiement inscription) ;
# Professeur saisit des notes + appel (1 absence + 1 retard) ; EDT.
# 1. Directeur → Cartes scolaires : Aperçu par alias ou par cycle (8 cartes/page A4,
#    QR du matricule). 2. Directeur → Bulletins : une page par élève (notes/moyenne/
#    coefficient/rang/moyenne de classe/assiduité/signature). Les PDF sont générés
#    en mémoire puis streamés — jamais écrits sur disque (vérifié).
# 3. Directeur → Communiqués : publier (ex. cible Parents) → chaque destinataire
#    reçoit une notification (cloche avec badge).
# 4. Parent : cloche (badge) → liste ; Notes (moyenne, rang, matières) ; Emploi du
#    temps (lecture seule) ; Situation financière (synthèse + échéancier + paiements).
```

## Tests manuels — Sprint 3

```bash
# PRÉALABLE : Directeur crée un Professeur + Périodes T1 (ouverte) / T2 (fermée),
# affecte Mathématiques×classe, alias, EDT (créneau existant).
# 1. Directeur → Périodes de saisie : T1 « Ouverte » / T2 « Fermée ».
# 2. Directeur → Emploi du temps : créneaux 55 min, création / glisser-déposer /
#    suppression ; chevauchement même alias/prof/salle → refus avec message précis.
# 3. Professeur → Tableau de bord : classes/matières/élèves + prochain cours +
#    graphique moyennes par classe.
# 4. Saisie des notes : T1 ouverte → saisir (virgule acceptée, ↑/↓/Entrée) ;
#    T2 fermée → bandeau rouge + saisie bloquée (403 API si appel direct).
# 5. Appel : marquer 1 absent + 1 retard 15 min → parents notifiés (email +
#    notification). Rejouer le même appel → aucune double notification.
# 6. Mon emploi du temps : vue semaine en lecture seule.
```

## Tests manuels — Sprint 2

```bash
# PRÉALABLE (réinitialiser) : ADMIN nomme un Directeur ; Directeur nomme
# Secrétaire + Comptable ; affecter Mathématiques à CP1/CP2/CE1 (coefs 4/4/5) ;
# créer les alias CP1 A / CE1 A.
# 1. Directeur → Frais de scolarité : appliquer 25000 / 250000 + MENSUEL à
#    CP1 et CE1 (cases à cocher).
# 2. Secrétaire → Nouvel élève : parcours 4 étapes ; l'élève inscrit avec
#    matricule auto ; compte Parent créé (aucun e-mail → mot de passe
#    temporaire affiché une seule fois + lien wa.me).
# 3. Secrétaire → Élèves & fiches → « Marquer payés » (frais d'inscription) →
#    reçu PDF (%PDF-…) — statut INSCRIT (sinon EN_ATTENTE).
# 4. Comptable → Paiements : rechercher Kouamé → encaisser une partie ;
#    l'échéancier se ventile (plus anciennes d'abord) ; payer le reste →
#    ECHÉANCES soldées. Annuler un paiement (motif obligatoire) →
#    ventilation restituée, statut ANNULE, trace audit_logs.
# 5. Comptable → Comptes : filtres cycle/classe/statut/modalité ;
#    « Fiches de retard (PDF) » ; Relances → cocher → « Relancer la sélection »
#    (notification interne + 0..n mails + lien wa.me pré-rempli ; historique).
# 6. Comptable → Rapports : générer → totaux cohérents ; « Exporter en PDF ».
# 7. Dashboard Secrétaire (inscriptions/jour, effectif par cycle) et
#    Dashboard Comptable (encaissé jour/mois, impayés, recouvrement, 30 j).
```

## Tests manuels — Sprint 1

```bash
# 1. Admin : se connecter, puis — Cycles/Classes/Matières/Années (CRUD complet),
#    Paramètres (changer le nom de l'école, uploader un logo), Directeurs →
#    créer un directeur (le mot de passe temporaire s'affiche dans la modale
#    car le mail est en dry-run, sinon il arrive par e-mail).
# 2. Directeur : se connecter avec ce mot de passe → changement obligatoire.
#    - Utilisateurs : créer Secrétaire / Comptable / Professeur.
#    - Alias : cycle → classe → « CP1 A ».
#    - Affectations, onglet 1 : matière « Mathématiques » → CP1/CP2/CE1
#      avec coefficients 4 / 4 / 5 → « Affectations actuelles » à droite.
#    - Affectations, onglet 2 : choisir un professeur → choisir « Mathématiques
#      (CP1) » → cocher « CP1 A » → Affecter. Une 2e tentative sur la même
#      ligne est refusée (409 « … déjà affecté … »).
# 3. Suppression d'un cycle contenant des classes → 409 avec message clair.
```

## Tests manuels — Sprint 0

```bash
# 1. Migration + seed
cd server && npm run migrate && npm run seed

# 2. API en marche, puis :
#    a. login Admin → mustChangePassword: true
curl -s -X POST http://localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}'

#    b. le token reçu ne permet pas d'atteindre une route métier tant que le
#       mot de passe n'est pas changé (403 PASSWORD_CHANGE_REQUIRED) :
curl -s -H "Authorization: Bearer <accessToken>" http://localhost:5000/api/protected/ping

#    c. changer le mot de passe via POST /api/auth/change-password
#    d. ping → 200 {"message":"pong", ...}
#    e. 5 mauvais mots de passe → le 6e essai (même avec le BON mot de passe)
#       renvoie 423 « Compte temporairement bloqué. Réessayez dans X minutes. »
#    f. /api/auth/refresh enchaîne la rotation ; rejouer l'ancien refresh → 401
```

Côté front : se connecter sur http://localhost:5173 → redirection forcée vers
« Changer le mot de passe » → après changement, arrivée sur le tableau de bord Admin.
Un compte d'un rôle X ne peut pas ouvrir l'URL d'un autre rôle (redirection + contrôle API).

## Avancement

| Sprint | Contenu | État |
|---|---|---|
| 0 | Fondations, auth complète, design system, 6 dashboards vides | ✅ Livré |
| 1 | Espace Admin (cycles/classes/matières/années/directeurs/paramètres) + Espace Directeur (utilisateurs, alias, affectations matière↔classe/coefficient, affectation professeur) | ✅ Livré |
| 2 | Inscriptions + comptabilité (frais & modalités, inscription élève + matricule + échéancier, compte Parent auto, paiement d'inscription, paiements scolarité + ventilation, comptes/fiches de retard/relances/rapports) — le reçu (inscription ou paiement) n'est PAS généré : il se remplit à la main et le scan peut être joint comme preuve (justificatif) | ✅ Livré |
| 3 | Espace Professeur + périodes de saisie : périodes d'évaluation + fenêtre de saisie stricte (API+UI), emploi du temps 55 min avec détection des chevauchements (alias/prof/salle) et glisser-déposer, saisie Excel des notes (clavier, moyenne instantanée, verrouillage), appel présents/absents/retard (notification parents) | ✅ Livré |
| 4 | Documents PDF (cartes 8/page avec QR, bulletins modèle togolais — une page A4 par élève, rangs 1er/2ème par matière et général, résultats de tous les trimestres, jamais stockés), communiqués ciblés (tous/rôle/cycle/classe/alias), notifications réelles (badge/cloche), espace Parent (notes, EDT, situation financière — consultation lecture seule) | ✅ Livré |
| 5 | Sauvegardes par année académique sous l'Administrateur + KPI sur tous les dashboards + revue sécurité + 28 tests automatisés + déploiement + gestion du profil (`/profil`) | ✅ Livré |
| 6 | Liste de renvoi (Comptable, classe entière, PDF signatures Comptable/Directeur) ; Emploi du temps / Cartes / Bulletins / Communiqués accessibles à la Secrétaire (bulletins & cartes protégés par le **feu vert** du Directeur) ; onglet Journal d'activités (Admin — toutes les activités de tout le monde) ; onglet Communiqués dans tous les espaces | ✅ Livré |

## Décisions & limites documentées

- **Charte graphique** : 4 couleurs définies en variables CSS avec nuances 50→900
  (`client/src/styles/variables.css`) ; aucun framework CSS (pas de Tailwind/Bootstrap).
- **Tokens** : access token en **mémoire** (jamais en localStorage) ; refresh token en
  localStorage, rotation serveur à chaque usage (l'ancien est révoqué). Un XSS resterait
  bloquant pour un vol définitif de session — mitigation prévue : durcissement CSP au
  déploiement (Sprint 5).
- **Seed idempotent** : relançable sans doublons. Changer `ADMIN_EMAIL` dans `.env` puis
  relancer `npm run seed` crée un **second** Admin si l'ancien existe encore — l'ancien peut
  être désactivé en base (`is_active = 0`).
- **`sequences.last_value`** est backtické (mot réservé MySQL 8.0).
- **Réponse login identique** que l'identifiant existe ou non ; comparaison bcrypt sur hash
  factice quand le compte n'existe pas (temps de réponse égalisé).
- **Mots de passe** : coût bcrypt 12 ; politique front+back : 8 caractères min., majuscule,
  minuscule, chiffre.
- **Blocage du login** : compteur `failed_login_attempts` + `locked_until` (configurable par
  `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES`), réouverture automatique, journalisé
  (`ACCOUNT_LOCKED` dans `audit_logs`).
- **Modules non livrés** : les entrées de menu des sprints suivants mènent à une page
  « En cours de construction » (jamais de lien mort, jamais de données inventées).
- **Échéancier / matricules / reçus** : utilitaires prêts (`utils/sequences.js`) —
  branchés au Sprint 2.
- **Documents (PDF)** : seront générés **en mémoire** puis streamés (Sprints 2–4) ; aucun
  PDF ne sera écrit sur disque. Seuls le logo de l'école et les photos d'élèves seront
  des fichiers stockés (`server/uploads/`).
- **Logo** : déplacé depuis la racine vers `client/src/assets/logo.png` (affiché dans la
  sidebar, la topbar et les pages d'auth).
- **Année académique courante** : calculée `1er septembre → 30 juin` (mois ≥ septembre
  ⇒ année courante ; sinon année précédente).
- Pas encore de tests automatisés : les parcours critiques seront couverts au Sprint 5
  (vitest/supertest) ; des canaris API (`/api/protected/ping`, `/api/protected/admin-only`)
  permettent de vérifier dès maintenant l'auth et le contrôle de rôle.

### Décisions & limites — Sprint 1

- **Périmètre des comptes** : l'Admin ne crée que des Directeurs ; le Directeur
  ne crée que Secrétaire/Comptable/Professeur (vérifié API + front).
- **Renvoi des identifiants** (Admin/Directeur) : génère un NOUVEAU mot de passe
  temporaire, coupe toutes les sessions du compte, et renvoie le mail. Si l'e-mail
  n'est pas délivré (dry-run, SMTP KO, ou compte sans e-mail), le mot de passe
  s'affiche UNE seule fois à l'écran dans une modale dédiée.
- **Suppression refusée avec détail** (409 `ENTITY_IN_USE`) : cycle contenant des
  classes, classe (alias/affectations/frais/inscriptions), matière affectée,
  alias affecté/inscrit/planifié, année courante ou utilisée, affectation matière
  avec professeurs liés, affectation professeur avec emploi du temps lié.
- **Coefficient par classe** (`class_subjects`) : upsert en masse dans une
  transaction ; le Directeur règle les coefficients dans la même interface que
  l'affectation.
- **Un professeur par matière/alias/année** : conflit explicite (409) ; l'affectation
  du professeur vérifie que l'alias appartient bien à la classe de la matière.
- **Affectations professeur** : validation de TOUTES les lignes avant écriture —
  opération tout-ou-rien.
- **Logo de l'école** : upload PNG/JPEG/WebP ≤ 2 Mo vers `server/uploads/`
  (servi en statique `/uploads/…`) ; l'ancien fichier est supprimé au remplacement.
  Les PDF (bulletins/cartes) l'intégreront au Sprint 4.
- **Audit** : CREATE/UPDATE/DELETE/SET_CURRENT_YEAR/ACTIVATE/DEACTIVATE/
  RESEND_CREDENTIALS/UPDATE_LOGO écrits dans `audit_logs` avec userId.
- **Dashboards** : KPIs réels via `/api/admin/dashboard` et `/api/directeur/dashboard`
  (graphique Chart.js : classes par cycle / utilisateurs par rôle).

### Décisions & limites — Sprint 2

- **Échéancier** : MENSUEL le 5 de chaque mois (début → fin d'année),
  JOURNALIER les jours ouvrés lun–ven, HEBDOMADAIRE chaque lundi,
  TRIMESTRIEL 5 nov / 5 fév / 5 mai, SEMESTRIEL 5 nov / 5 mars. 11 échéances
  pour MENSUEL Sep→Juil. Montants entiers en centimes, dernière échéance =
  solde de l'arrondi. Frais FIGÉS dans l'inscription (changement ultérieur des
  tarifs sans impact). Journalier ≈ 160 lignes par élève — acceptable.
- **Compte Parent unique** : créé par téléphone (unique) ; un tuteur de
  plusieurs enfants partage le même compte. Si le téléphone/e-mail appartient
  à un compte non-parent → 409 clair. Sans e-mail → mot de passe affiché UNE
  seule fois à l'écran + lien wa.me (canal principal, pas d'API payante).
- **Inscription EN_ATTENTE → INSCRIT** au paiement des frais d'inscription.
  Double paiement d'inscription → 409. Annulation d'un paiement d'inscription
  → retour EN_ATTENTE ; annulation scolarité → ventilation restituée entière.
- **Ventilation** : par ordre d'échéance (numero) dans la même transaction SQL ;
  surpaiement refusé (montant > reste dû). Annulation = statut ANNULE +
  restitution + audit (jamais de DELETE).
- **Relance** : notification interne (si compte Parent) + e-mail (si disponible,
  sinon dry-run) + lien wa.me pré-rempli ; historique dans `payment_reminders`
  (canaux NOTIFICATION / EMAIL / WHATSAPP). Sélection groupée ou individuelle.
- **Statuts scolarité** : SOLDE (tout payé), EN_RETARD (≥1 échéance en retard et
  non soldée), A_JOUR sinon. Calcul SQL avec sous-requêtes (aucune colonne
  flottante côté calcul).
- **Rapports** : attendu = Σ scolarité des enrollments ; encaissé = Σ paiements
  SCOLARITE VALIDE ; par classe, agrégés par cycle ; PDF à la volée en mémoire.
- **Séquentiels** : matricule `MAT-2026-NNNNN` et reçu `REC-2026-NNNNNN` via la
  table `sequences` (LAST_INSERT_ID atomique, connexion dédiée).
- **Photos élèves** : upload facultatif → `server/uploads/photos/` ; l'inscription
  reste possible sans photo.
- **Logo école** : `server/uploads/logo/` (remplace l'ancien à chaque upload).
- **Magic number de relance « en retard »** : compte avec reste > 0 (Impression
  d'impayés ≠ échéance passée — toute dette > 0 relance).

### Décisions & limites — Sprint 3

- **Moyennes** : service unique `moyenneService.js` — testé (`npm test`).
  `(moyenne(interro, devoir) + compo) / 2`, valeurs manquantes ignorées, jamais
  comptées comme 0 ; moyenne générale pondérée par coefficient, arrondie à 2 déc.
- **Appréciation automatique, non modifiable** : la colonne « Appréciation » du
  bulletin est **toujours calculée** à partir de la moyenne de la matière
  (16–20 Très bien · 14–15 Bien · 12–13 Assez bien · 10–11 Passable ·
  8–9 Insuffisant · 6–7 Faible · 0–5 Médiocre). Le professeur ne peut pas la
  saisir (champ supprimé dans « Saisie des notes », ignoré côté API —
  migration `005` neutralise les anciennes valeurs).
- **Fenêtre de saisie** : `evaluation_periods.saisie_debut/saisie_fin`.
  **Une seule période peut être ouverte à la fois** : les fenêtres ne peuvent
  pas se chevaucher (validation serveur à la création/modification, erreur
  `409 SAISIE_DEJA_OUVERTE`) ; une période sans fenêtre définie est **fermée
  par défaut** (le Directeur ouvre la saisie explicitement). Toute écriture
  hors fenêtre → 403 `SAISIE_FERMEE` (API) + UI verrouillée. Lecture toujours
  possible, écriture strictement fenêtrée. Une période sans fenêtre est fermée
  par défaut ; si plusieurs périodes étaient déjà ouvertes (données anciennes),
  un bandeau d'alerte s'affiche sur la page Périodes.
- **Notes** : 0–20 côté API (Zod + service) et côté interface (cellule rouge si
  hors bornes). Upsert en transaction : un prof ne touche QUE ses matières×alias.
- **EDT** : créneaux `nb_heures × 55 min` ; `heure_fin` calculée. Conflits
  (alias / professeur / salle) → 409 avec message précis (date, jour, horaire).
  Déplacement par glisser-déposer (snap 55 min) ou via l'édition.
- **Appel** : unique par (affectation, date, heure de début) — la re-saisie le
  jour même remplace la séance sans doubler ; notifications aux parents UNIQUEMENT
  pour les NOUVEAUX absents/retards (idempotence).
- **Notifications** : ABSENCE / RETARD (parent) et SCOLARITE (inscription) —
  affichées dans la cloche (badge) et l'espace parent au Sprint 4.
- **Professeur** : accès strictement limité à SES affectations (contrôle API sur
  chaque route : 403 sinon).

## Décisions & limites — Sprint 6

- **Liste de renvoi** : l'application ne connaît pas de notion de « tranche ». Le
  comptable choisit **classe + date d'arrêt** ; la liste reprend **tous** les
  élèves de la classe avec : payé sur le dû (versements affectés aux échéances
  ≤ date d'arrêt), reste dû, **Total à régler** (= échéances dues non couvertes
  à la date d'arrêt, arriérés inclus), total payé, reste écolage complet,
  dernier versement, statut À jour / À renvoyer. Les élèves « à renvoyer » sont
  teintés (écran + PDF). Si la date d'arrêt est dans le futur → mention
  « prévisionnelle » (même esprit que le PDF papier d'origine).
  - « Écolage complet » affiché = frais de la classe (tuition_fees) ; si absent,
    montant figé à l'inscription (si un seul montant) sinon « variable ».
  - PDF : modèle togolais (entête école, entêtes de colonnes, totaux, note
    explicative, lignes de signatures LE COMPTABLE / LE DIRECTEUR, aucune
    mention « tranche »). Généré en mémoire, jamais écrit sur disque.
  - Journalisé (`LISTE_RENVOI`) — visible dans l'onglet Journal.
- **Feu vert (bulletins & cartes)** : deux autorisations permanentes,
  activables/désactivables, réservées au DIRECTEUR
  (`school_settings.cartes_impression_autorisee` / `bulletins_impression_autorisee`,
  migration `006`). La SECRÉTAIRE obtient 403 `IMPRESSION_NON_AUTORISEE` à la
  génération du PDF tant que le feu vert est coupé ; son écran affiche un bandeau
  et désactive les boutons (ré-activés automatiquement à la levée, sans recharger).
  Le DIRECTEUR n'est jamais contraint. Chaque bascule → notification à tous les
  secrétaires actifs + audit (`UPDATE_FEUVERT`). Les drapeaux sont lisibles par
  tout compte connecté via `/parametres` (information non sensible).
- **Emploi du temps / cartes / bulletins / communiqués** : écrans **partagés**
  Directeur ↔ Secrétaire (`pages/_shared/*Espace.jsx`, prop `espace`). Les
  routes API de l'emploi du temps sont montées sous les deux espaces avec les
  mêmes contrôleurs/règles (`routes/edtRoutes.js`) ; cartes, bulletins et
  communiqués sont montés sous `/api/secretaire` (mêmes services, le feu vert
  appliqué uniquement côté secrétaire). Le Directeur conserve tous ses écrans.
- **Paramètres de l'école** : maintenus dans l'espace **Directeur** (choix
  confirmé). Incohérence documentée : les tests Sprint 1 le plaçaient côté Admin ;
  il a été déplacé au Sprint Documents, puis confirmé côté Directeur.
- **Journal d'activités (Admin)** : `/admin/journal` — lecture paginée de
  `audit_logs` enrichie (auteur joint, rôle), filtres : recherche (auteur),
  action, entité, période ; détail d'une ligne (avant/après en JSON).
  Journalise désormais aussi : `GENERATE_CARTES` / `GENERATE_BULLETINS`
  (PDF générés, avec alias/cycle + rôle) et `LISTE_RENVOI`.
- **Communiqués — onglet dans tous les espaces** : `/communiques`
  (lecture seule, filtré) ajouté pour Admin / Comptable / Professeur / Parent ;
  Directeur et Secrétaire publient et voient tout (avec l'éditeur existant).
  Admin voit tout (pilotage/journalisation). Comptable/Professeur/Parent voient
  les communiqués qui les concernent : TOUS, rôle ciblé, ou cycle/classe/alias
  liés à leurs élèves (parent) ou affectations (professeur).
  - Cibles ROLE étendues à ADMIN et DIRECTEUR (migration `006`).
  - TOUS notifie désormais tous les comptes actifs (inclut Admin/Directeur).
- **WhatsApp — absences / retards** : envoi **manuel** via liens wa.me
  pré-remplis (modèle des relances, zéro coût). Après l'enregistrement de
  l'appel, le professeur voit une modale listant chaque NOUVEAU absent/retardaire
  avec un bouton « Ouvrir WhatsApp » (message pré-rempli mentionnant l'enfant,
  la date, la matière et le renvoi vers l'espace Parent → « Absences & motifs »
  pour le motif). Le lien est valable même pour un tuteur SANS compte School
  Vie. Idempotence : rejouer le même appel le jour même ne propose rien de plus
  (même règle que les notifications internes). Le push automatique 100 %
  silencieux (Cloud API Meta, numéro Business + templates approuvés) reste
  possible plus tard — non retenu pour l'instant.
- **WhatsApp — mots de passe provisoires (REPORTÉ)** : les mots de passe
  temporaires partent par e-mail quand l'adresse existe, sinon s'affichent une
  fois à l'écran + lien wa.me manuel (comportement inchangé). L'envoi
  automatique par WhatsApp sera traité ultérieurement (même arbitrage d'API).
- **Notifications** : le type `SYSTEME` (déjà présent dans l'énumération) est
  utilisé pour les messages de feu vert — aucune migration de la cloche requise.

## Reçus : remplissage manuel + scan en preuve

L'application **ne génère plus de PDF de reçu** (avant : reçu d'inscription et
reçu de paiement à la volée). Les reçus sont remplis à la main comme
d'habitude. En revanche, le **secrétaire** (paiement d'inscription) et le
**comptable** (paiements de scolarité et inscription) peuvent **joindre un
scan/photo du reçu** (PDF, PNG, JPEG, WebP — 5 Mo max) directement depuis
- l'écran de confirmation d'inscription (écran « Inscription terminée ») ;
- la fiche élève (secrétaire) — colonne « Preuve » dans le tableau des paiements
  + bouton dans le bloc « Frais d'inscription » ;
- l'écran d'encaissement (comptable) — juste après l'Enregistrer ;
- la fiche de situation (comptable, modal) — colonne « Preuve ».

La preuve est liée au paiement (`payments.justificatif_chemin`), remplaçable
et retirable, visible par le secrétaire et le comptable « en cas de quoi »
(contrôle, litige). Elle n'est **pas** visible des parents. Fichiers servis en
lecture via `/uploads/justificatifs/` (noms aléatoires). Retirée/remplacée
proprement : l'ancien fichier est supprimé du disque.

### Décisions & limites — Sprint 4

- **Cartes scolaires** : 2×4 par page A4, QR code du matricule (npm `qrcode`,
  généré en mémoire). Nom de fichier propre dans le téléchargement
  (`bulletins-CP1-A.pdf` via `Content-Disposition` exposé par CORS).
- **Bulletins** : design pdfkit au modèle togolais (en-tête RÉPUBLIQUE
  TOGOLAISE + ministère, nom/logo de l'école, double filet, une page A4 par
  élève, signature/cachet du Chef d'établissement si configurés). Rang par
  compétition (1, 1, 3) affiché **1er/2ème/…** ; rang par matière ET rang
  général ; moyenne de classe = moyenne des moyennes générales renseignées.
  Calcul partagé (`classesDataService.js`) avec l'espace Parent.
- **Communiqués** : cibles TOUS / ROLE / CYCLE / CLASSE / ALIAS ; résolution
  des destinataires (parents des inscrits + professeurs affectés),
  dédupliquée ; une notification par destinataire. Historique `announcements`
  affiché avec auteur et dates.
- **Notifications réelles** : API `/api/notifications` (liste paginée,
  non-lus, marquer lu / tout lu) ; la cloche du Topbar est branchée et
  rafraîchie toutes les 30 s ; cliquer sur une notif la marque comme lue.
- **Espace Parent** : lecture seule stricte ; un parent ne voit QUE ses
  enfants (requête SQL filtrée par `guardians.user_id`) ; sélecteur d'enfant
  si plusieurs ; notes (avec rang et moyenne de classe), EDT (Calendar
  read-only), situation financière (synthèse + échéances + paiements).
  Aucune action modifiable (pas d'écriture possible).
- **Aucun PDF sur disque** : générés en mémoire avec pdfkit puis streamés
  (`Cache-Control: no-store`). Vérifié sur le disque du serveur.
- **CORS** : `Content-Disposition` exposé pour des téléchargements nommés.

### Décisions & limites — Sprint 5

- **Sauvegardes** : export EN MÉMOIRE puis streamé (jamais écrit sur disque).
  JSON (restaurable) ou SQL (lecture/inspection). Toutes les tables métier
  sauf `users`, `refresh_tokens`, `password_resets`, `audit_logs`,
  `backup_logs`, `notifications`, `announcements`, `school_settings`
  → la restauration **préserve les comptes, l'audit et les notifications**.
  Enregistrée dans `backup_logs` (traçabilité, sans le fichier lui-même).
  Restauration en transaction (FK_CHECKS=0), lots de 200 lignes, dates ISO
  normalisées ; confirmation forte (RESTAURER) côté UI + dialog + journalisée.
- **Gestion du profil** (`/profil`, tous les rôles) : modifier nom/prénom/
  e-mail/téléphone (e-mail/téléphone uniques) + changement de mot de passe.
  Ajoutée dans la sidebar de chaque rôle.
- **Tests automatisés** (`npm test`) : 12 tests unitaires (moyennes, 0–20,
  virgule, appréciations) + 16 tests d'intégration contre une base jetable
  `school_vie_test_db_004774` (créée, migrée, seedée puis supprimée) :
  login/verrouillage 30 min, mot de passe obligatoire, rôles, inscription,
  paiement d'inscription, ventilation de scolarité, fenêtre de saisie (403
  SAISIE_FERMEE), chevauchement EDT (409), matrice 401/403/404.
- **Revue sécurité** : matrice rôle×route vérifiée (chacun → sa route 200,
  autres 403) ; rate-limit global + renforcé (login/reset) ; verrouillage ;
  helmet + CORS restreint ; SQL préparée partout ; aucun `password_hash` dans
  les réponses ; audit (`audit_logs`) systématique sur mutations sensibles.
- **Dashboards finalisés** : Admin (+élèves/profs/parents/recouvrement),
  Directeur (+recouvrement/absences/retards), Secrétaire (+inscriptions mois),
  Professeur (+absences mois), Comptable (déjà : jour/mois/impayés/taux +
  graphiques), Parent (sections messages).
- **Déploiement** : `npm run build` (client) → build statique servi par un
  serveur/reverse-proxy (nginx/caddy) + PM2 ou Docker pour le back ;
  variables d'environnement comme en dev (DB_*, JWT_*, SMTP_* avec
  `MAIL_DRY_RUN=false` et `SMTP_PASS` renseigné, `CLIENT_URL` en HTTPS).
  Sauvegarde de la base : `mysqldump school_vie_db_004774 > backup-$(date +%F).sql`.

## Bulletins (modèle togolais) & justifications d’absence

### Bulletin PDF (une page A4 par élève)
Modèle officiel **République togolaise** : `RÉPUBLIQUE TOGOLAISE` · devise
*Travail – Liberté – Patrie* · **Ministère de l’Éducation Nationale** ·
logo + nom de l’école (paramètres de l’école). Pas de totaux de groupes
(« TOTAL SCIENCES »…), pas d’« Enseignant principal », pas de visa parent.
Contenu :

- informations de l’élève (matricule, né(e) le, classe/alias, effectif, sexe) ;
- tableau des matières : Interro, Devoir, Compo, Moy., Coef, **Total**
  (moyenne × coefficient), **Rang par matière** et appréciation ;
- moyenne générale pondérée + **rang général** ;
- **RÉSULTAT DE L’ÉLÈVE** : moyenne et rang (1er, 2ème…) de chaque trimestre
  de l’année (le trimestre courant surligné) + appréciation générale ;
- **PROFIL DE LA CLASSE** : admis (moy. 10/20), moyenne classe, % réussite,
  max/min ;
- **TRAVAIL DE L’ÉLÈVE** : Tableau d’Honneur / Encouragement / Félicitation /
  Avertissement / Blâme (mentions *automatiques* indicatives, décision finale
  au conseil de classe) ;
- **CONDUITE DE L’ÉLÈVE** : absences totales / justifiées / non justifiées,
  retards ;
- **DÉCISION DU CONSEIL DE CLASSE** (cadre vierge) + **VISA DU CHEF
  D’ÉTABLISSEMENT** (signature et cachet numériques de l’école si configurés).

Les rangs s’affichent toujours au format français : **1er, 2ème, 3ème…**
(jamais « 1/54 »). Calcul partagé (`classesDataService.js`) entre bulletins
et espace Parent : rangs par compétition (1, 1, 3), ex æquo partagés,
moyenne de classe = moyenne des moyennes générales renseignées.

### Présences & justifications
- Le **professeur** marque les absents/retards à l’appel (inchangé) et peut,
  en option, marquer chaque absence **« justifiée »** (bouton + note
  facultative).
- Le **parent** voit les absences/retards de son enfant (page « Absences &
  motifs ») et peut envoyer un **motif** (≤ 500 caractères). Un avertissement
  s’affiche : le motif sera communiqué à l’école et pourra être utilisé au
  **conseil de discipline**. Le parent peut modifier ou retirer son motif
  (jamais celui saisi par le professeur).
- Le motif du parent est **conservé** si le professeur re-enregistre l’appel
  (fusion intelligente : statut + note identiques → auteur/date conservés).
- **Statistiques** (Directeur + Secrétaire) : `/directeur(secretaire)/statistiques-presences`
  — totaux (absences justifiées / non, retards, taux), évolution par période,
  par alias/classe (effectifs, séances, taux d’absence), liste des élèves
  concernés (+ recherche) et détail complet par élève (date, matière, motif).
  Le Directeur dispose aussi du détail par élève (modale) ; le Professeur a
  « Absences de mes élèves » (`/professeur/absences-eleves`) avec le même
  détail.
- Les parents sont **notifiés à chaque absence/retard** (inchangé).

### Données de démonstration (bulletins/présences)
```bash
cd server
npm run seed:demo   # crée des données FICTIVES (voir ci-dessous)
npm run demo:reset  # supprime exactement ces données (+ restaure les paramètres école)
```
- École fictive togolaise « École primaire publique de Bè-Klikamé » (le
  `school_settings` réel est sauvegardé puis restauré par `demo:reset`) ;
- 8 élèves fictifs « DEMO-0001…0008 » en **CE1 A** (Primaire) ;
- 1 professeur `prof.demo@demo.example.tg` / `Demo12345!`, 1 parent
  `parent.demo@demo.example.tg` / `Demo12345!` (8 enfants), 1 comptable
  `comptable.demo@demo.example.tg` / `Demo12345!` (comptes, fiches de
  retard PDF, relances, rapports) ;
- notes des Trimestres 1 et 2, absences/retards avec motifs variés
  (justifiée parent, justifiée professeur, non justifiées) ;
- échéanciers MENSUEL (9 échéances/élève) + paiements fictifs d'inscription
  et de scolarité répartis (paiements ESPECES/FLOOZ/MIXX, ventilation
  appliquée) — le comptable a donc des données à l'écran ;
- `.demo-manifest.json` (ignoré par git) liste tout ce qui est créé →
  `demo:reset` supprime précisément ces éléments.

## Sécurité (rappel)

- Helmet, CORS restreint à `CLIENT_URL`, rate-limit global (600/15 min) et renforcé sur
  login/reset (10–30/15 min).
- `password_hash` ne quitte jamais le serveur ; audit (`audit_logs`) sur login, échecs,
  verrouillage, changement/reset de mot de passe.
- `.env` ignoré par git ; aucun secret dans le dépôt ; `.env.example` complété sans secrets.
- Changement de mot de passe **imposé** à la première connexion (403 `PASSWORD_CHANGE_REQUIRED`
  sur toute route métier tant que `must_change_password = 1`).
