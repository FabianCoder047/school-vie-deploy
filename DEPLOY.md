# School Vie — mise en ligne (Render + MySQL managé) & PWA

## 1. Architecture retenue

| Composant | Hébergement | Notes |
|---|---|---|
| Backend Express | Render **Web Service** (`school-vie-api`) | Node 20, migrations auto au démarrage |
| Frontend React (PWA) | Render **Static Site** (`school-vie-app`) | build Vite, service worker inclus |
| Base de données | **MySQL managé externe** (Aiven / Railway / Clever Cloud) | Render ne propose pas de MySQL managé |
| Photos, logo, signature, reçus scannés | **Disque persistant Render** `/data` | monté sur `/data/uploads` via `UPLOADS_DIR` |

## 1bis. Déploiement effectif (24 nov 2026)

| Ressource | Valeur |
|---|---|
| Frontend (PWA) | https://school-vie-app.onrender.com |
| API | https://school-vie-api.onrender.com/api |
| Health check | https://school-vie-api.onrender.com/api/health |
| Service Render API | `srv-dc2bah6c6qcc73denpa0` (plan **free**, région Francfort) |
| Service Render front | `srv-dc2bmjek1f9s73a74870` (Static Site, rewrites SPA configurés) |
| Base Aiven MySQL | `schoolvie-db004774-fabiodab83-dd5f.g.aivencloud.com:18922`, base `defaultdb` |
| Dépôt source déployé | https://github.com/FabianCoder047/school-vie-deploy (**miroir public** — le dépôt original `school-vie-project` reste privé) |
| Compte Admin initial | `admin@school-vie.local` (mot de passe temporaire communiqué hors dépôt, changement obligatoire à la 1re connexion) |
| Envoi de mails | **Resend** (`MAIL_PROVIDER=resend`), clé `RESEND_API_KEY` configurée dans Render. Test validé le 24/11/2026 via `onboarding@resend.dev` → compte Resend. |

⚠️ `onboarding@resend.dev` ne peut envoyer **qu'à l'adresse du compte Resend**
(`paulingoudo@gmail.com`). Pour envoyer aux parents, **vérifiez un domaine dans
Resend** (Domaines → Add Domain → DNS) puis remplacez `MAIL_FROM` par
`no-reply@votre-domaine.vérifié` dans les variables Render `school-vie-api`.

**Limites du plan gratuit Render** : l'API se met en veille après inactivité
(premier accès ~10–50 s) et les fichiers uploadés (photos, logo, reçus) ne
sont **pas persistants** (ils sont stockés dans `server/uploads` dans le
conteneur). Pour un usage réel : passer l'API en plan `starter`, ajouter un
disque persistant monté sur `/data` et rétablir `UPLOADS_DIR=/data/uploads`
(les lignes correspondantes sont commentées dans `render.yaml`).

**Sécurité après déploiement** : la clé API Render, le mot de passe Aiven et le
mot de passe d'application Gmail ont été transmis pour le déploiement. Il est
recommandé de les **faire tourner** (Render → API Keys → Revoke ; Aiven →
Reset password ; Gmail → nouveau mot de passe d'application) puis de mettre à
jour les variables dans le service Render `school-vie-api`.

> **Pourquoi pas Vercel ?** Vercel est serverless : le système de fichiers y est
> éphémère (les photos uploadées disparaîtraient) et l'Express actuel (pool
> MySQL, multer disque, rate-limit en mémoire) devrait être réécrit. Render est
> le bon choix ici, avec un coût mensuel modeste (voir §8).

---

## 2. PWA installable — ce qui a été fait

- `vite-plugin-pwa` génère le **manifest** et le **service worker** au build.
- Enregistrement explicite du SW dans `client/src/main.jsx` (`registerSW`).
- `manifest.webmanifest` : `name`, `short_name`, `id`, `display: standalone`,
  `orientation: any`, `theme_color`, icônes 192/512 + **maskable 512**,
  `start_url: '/'`, `scope: '/'`.
- `index.html` : meta iOS (`apple-mobile-web-app-capable`, titre, status bar),
  `apple-touch-icon` 180×180, `application-name` pour Windows.
- Bouton **« Installer l'appli »** dans la barre supérieure :
  - Android / Chrome / Edge / PC : déclenche le dialogue natif
    (`beforeinstallprompt`) ;
  - iPhone / iPad : affiche les instructions « Partager → Sur l'écran d'accueil »
    (Safari n'expose pas `beforeinstallprompt`) ;
  - le bouton disparaît si l'app tourne déjà en mode autonome.
- `client/public/_redirects` : les URL React (`/directeur/matieres`…) renvoient
  vers `index.html` sur le Static Site Render.
- Aucune donnée métier n'est mise en cache : seuls l'app shell (JS/CSS/HTML) est
  précaché ; les appels `/api/*` et `/uploads/*` sont exclus du cache.

### Logo de l'école

Le logo uploadé dans *Paramètres de l'école* est désormais utilisé **partout** :
barre latérale, en-tête, pages de connexion / mot de passe, page de maintenance,
**favicon du navigateur** et aperçu des paramètres (repli sur le logo par défaut
si aucun logo n'a été uploadé).

L'icône d'installation de la PWA est, elle, générée au **build** depuis un fichier
local. Pour qu'elle représente l'école, déposez le logo dans le dépôt puis :

```bash
cd school-app/client
SCHOOL_LOGO_FILE=/chemin/vers/le-logo-de-lecole.png npm run pwa:icons
npm run build
```

Le script `scripts/generate-pwa-icons.mjs` (sharp) recrée `icon-192`, `icon-512`,
`maskable-512` (marge de sécurité Android), `apple-touch-icon` (180) et
`favicon-32` avec le logo, puis le build les embarque dans le manifest.

### Checklist de vérification après mise en ligne

1. Ouvrir l'URL **en HTTPS** (obligatoire pour le service worker, sauf `localhost`).
2. Chrome/Edge PC : icône « Installer » dans la barre d'adresse ou menu ⋮ →
   *Enregistrer et partager* → *Installer School Vie*.
3. Android Chrome : menu ⋮ → *Ajouter à l'écran d'accueil* / *Installer l'application*.
4. iPhone/iPad Safari : bouton Partager → *Sur l'écran d'accueil* → *Ajouter*.
5. Depuis l'app installée, vérifier que la connexion fonctionne et qu'un rechargement
   hors ligne affiche au moins l'écran de connexion (app shell).
6. Dans Chrome DevTools → Application → Manifest : aucun avertissement « installabilité ».

---

## 3. Pré-requis

- Un compte **Render** connecté à GitHub (`FabianCoder047/school-vie-project`).
- Un **MySQL managé** (Aiven, Railway, Clever Cloud…) : host, port, user,
  password, base. **Autoriser les IP de sortie Render** si le fournisseur a un
  firewall (Aiven permet d'autoriser `0.0.0.0/0` avec TLS).
- Un compte **SMTP** (Gmail + mot de passe d'application, ou autre) pour les
  e-mails de bienvenue / réinitialisation.

---

## 4. Étape 1 — Préparer la base MySQL

Créer la base (nom par défaut `school_vie_db_004774`, UTF-8) et un utilisateur
dédié :

```sql
CREATE DATABASE school_vie_db_004774
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'schoolvie'@'%' IDENTIFIED BY 'UN_MOT_DE_PASSE_SOLIDE';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON school_vie_db_004774.* TO 'schoolvie'@'%';
FLUSH PRIVILEGES;
```

- Renseigner **DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME** dans Render.
- Mettre **DB_SSL=true** (Aiven/Railway l'exigent).
- **DB_SKIP_CREATE_DATABASE=true** est déjà réglé dans `render.yaml` : les
  migrations n'exécutent ni `CREATE DATABASE` ni `USE`, l'utilisateur n'a donc
  pas besoin du droit global `CREATE DATABASE`.

---

## 5. Étape 2 — Déployer avec le Blueprint Render

1. Render Dashboard → **New → Blueprint**.
2. Sélectionner le dépôt GitHub, branche `main`, et le fichier `render.yaml`
   (à la racine du dépôt — la racine Git est le dossier `school-app`).
3. Renseigner les variables marquées `sync: false` :
   `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `SMTP_*`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
   Les secrets JWT sont générés automatiquement (`generateValue: true`).
4. **Create Resources**. Render crée :
   - `school-vie-api` : `npm ci` puis `node src/database/migrate.js && node src/server.js` ;
   - `school-vie-app` : `npm ci && npm run build`, publié depuis `dist`.
5. Attendre le premier déploiement. Vérifier :
   ```
   curl https://school-vie-api.onrender.com/api/health
   # → {"status":"ok",...}
   ```
6. Vérifier dans les logs de l'API que les migrations `001…012` sont appliquées
   (une seule fois). En cas d'erreur de connexion MySQL, voir §9.

> Le frontend est servi sous `https://school-vie-app.onrender.com`, l'API sous
> `https://school-vie-api.onrender.com`. `CLIENT_URL` et `RESET_PASSWORD_URL`
> sont déjà réglés en conséquence dans le Blueprint. **VITE_API_URL est lu au
> build** : si vous changez le nom du service API, modifiez-le dans
> `render.yaml` puis redéployez le Static Site.

---

## 6. Étape 3 — Créer le compte Admin (une seule fois)

Le seed **réinitialise le mot de passe Admin à chaque exécution** : ne le
lancez qu'une fois, depuis le Shell Render :

1. Dashboard Render → service `school-vie-api` → **Shell**.
2. Exécuter :
   ```bash
   node src/database/seed.js
   ```
3. Se connecter sur `https://school-vie-app.onrender.com` avec `ADMIN_EMAIL` /
   `ADMIN_PASSWORD`, puis **changer le mot de passe** (obligatoire).
4. Dans l'espace Admin, vérifier : cycles, classes CP1/CP2/CE1, année courante,
   puis créer la structure de l'école (paramètres, directeur, utilisateurs…).

---

## 7. Étape 4 — Domaines personnalisés & e-mails

- Render → chaque service → **Settings → Custom Domain** : ajouter
  `ecole.example.com` (front) et `api.example.com` (API).
- Mettre à jour en conséquence **CLIENT_URL**, **RESET_PASSWORD_URL** (API) et
  **VITE_API_URL** (front, puis **rebuild**), sinon CORS et liens de reset cassent.
- `MAIL_DRY_RUN=false` + `SMTP_USER` / `SMTP_PASS` renseignés pour l'envoi réel.

---

## 8. Coûts indicatifs (Render, janvier 2026)

| Ressource | Plan | Coût |
|---|---|---|
| Web Service API (disque persistant inclus) | Starter | ~7 $/mois |
| Static Site frontend | Free | 0 $ |
| MySQL managé Aiven / Railway | selon offre | ~5–15 $/mois |

Sans le disque persistant, le plan Free est possible mais les services
s'endorment après inactivité (premier accès lent) et **les uploads sont perdus
à chaque redéploiement** : déconseillé pour une école.

---

## 9. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `-access denied` / `ER_ACCESS_DENIED_ERROR` au démarrage | IP Render non autorisée | Autoriser l'IP de sortie chez le fournisseur MySQL |
| `ER_SSL_HANDSHAKE_ERROR` | `DB_SSL` mal réglé | Mettre `DB_SSL=true` chez Aiven/Railway |
| `CREATE DATABASE command denied` | `DB_SKIP_CREATE_DATABASE` absent | Base pré-créée + `DB_SKIP_CREATE_DATABASE=true` |
| Page blanche / routes 404 au rafraîchissement | `_redirects` absent du build | Vérifier que `client/public/_redirects` est bien copié dans `dist` |
| « Installer l'appli » absent | HTTPS manquant ou PWA non installable | Ouvrir en HTTPS ; contrôler le manifest dans DevTools |
| Photos/reçus perdus après redéploiement | `UPLOADS_DIR` pas sur le disque | Vérifier `UPLOADS_DIR=/data/uploads` et le disque monté sur `/data` |
| `Connection timeout` lors de l'envoi de mail (log `Échec de l'envoi du mail d'identifiants`) | **Render gratuit bloque les ports SMTP 25/465/587** (changelog Render du 16/09/2025) | ✅ Résolu ici via `MAIL_PROVIDER=resend` + `RESEND_API_KEY` (API HTTPS). Pour les vrais destinataires, vérifier un domaine Resend et adapter `MAIL_FROM`. Alternative : passer l'API en plan payant pour réutiliser Gmail SMTP. |
| Resend répond `403 You can only send testing emails to your own email address` | `MAIL_FROM=onboarding@resend.dev` avec un destinataire externe | Vérifier un domaine dans Resend et utiliser `no-reply@votre-domaine` comme `MAIL_FROM` |
| CORS bloqué | `CLIENT_URL` erroné | Renseigner l'URL exacte du front (HTTPS, sans slash final) |

---

## 10. Sauvegardes

- **Base** : utiliser l'outil de backup du fournisseur MySQL (Aiven/Railway
  proposent des snapshots) ou, depuis le Shell Render :
  ```bash
  mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD \
    --single-transaction --routines $DB_NAME > /data/backup-$(date +%F).sql
  ```
- **Fichiers uploadés** : le disque Render `/data` est persistant mais **n'est
  pas backupé automatiquement** ; le télécharger via `render disk:download` ou
  le synchroniser vers un stockage objet (S3/Cloudflare R2) si les reçus scans
  sont importants.
