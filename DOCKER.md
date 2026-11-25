# School Vie — déploiement Docker "tout-en-un"

Même principe que `allo-togo-store` : **une seule image** contient l'API Express,
la SPA React/Vite (PWA) et **MySQL 8**. Au démarrage, l'entrypoint enchaîne :

```
MySQL 8 (local) → création base/utilisateur → migrations → seed admin (1 fois) → API + SPA
```

Résultat : plus de service Render en échec à cause d'une base externe, plus de
CORS à synchroniser, plus de static site séparé. Une seule URL sert tout :
`/api/health`, `/api/*`, `/uploads/*` et l'interface.

---

## 1. Démarrage local

```bash
cd school-app
cp .env.example .env        # changez au moins les secrets JWT
docker compose up -d --build
docker compose logs -f app  # le mot de passe admin généré s'affiche ici
```

Ouvrir **http://localhost:5000**. Vérification :

```bash
curl http://localhost:5000/api/health
# {"status":"ok",...}
```

Commandes utiles :

```bash
docker compose restart app          # redémarrer
docker compose down                 # arrêter (les données restent dans le volume)
docker compose down -v              # arrêter ET supprimer la base
docker compose exec app sh          # shell dans le conteneur
```

### Mot de passe admin

- Si `ADMIN_PASSWORD` est vide dans le `.env`, un mot de passe aléatoire est
  généré et **affiché dans les logs au premier démarrage**.
- Le seed n'est joué **qu'une seule fois** (marqueur `/data/.seeded`) car il
  réinitialise le mot de passe admin. Pour le relancer après avoir modifié
  `ADMIN_PASSWORD` : `FORCE_SEED=true` dans le `.env`, puis `docker compose up -d`.
- **Changez le mot de passe à la première connexion** (obligatoire dans l'app).

---

## 2. Persistance des données

Tout ce qui doit survivre à un redéploiement est sous **`/data`** :

| Chemin | Contenu |
|---|---|
| `/data/mysql` | base MySQL 8 (tables, élèves, notes…) |
| `/data/uploads` | photos, logo, signature, justificatifs |
| `/data/.seeded` | marqueur "seed déjà joué" |

En local, le volume nommé `school-vie-data` du `docker-compose.yml` assure la
persistance. **Sur Render, il faut attacher un disque persistant monté sur
`/data`** (plan Starter). Sans disque (plan Free), la base est réinitialisée à
chaque redémarrage : utilisable pour une démo, pas pour une école réelle.

Sauvegarde depuis l'hôte :

```bash
docker compose exec app sh -c \
  "mysql --protocol=socket -uroot school_vie_db_004774 --default-character-set=utf8mb4" \
  > backup-$(date +%F).sql
```

---

## 3. Déploiement sur Render (remplace les services `school-vie-api` + `school-vie-app`)

Le fichier `render.yaml` a été converti en **Blueprint Docker** : un seul
service `school-vie-api` (runtime `docker`, plan Starter, disque `/data`,
healthcheck `/api/health`). Le push sur la branche `main` du dépôt
`FabianCoder047/school-vie-deploy` déclenche le redéploiement.

1. Pousser les fichiers sur `school-vie-deploy` (dépôt miroir branché sur Render) :
   ```bash
   git push deploy main
   ```
2. Si Render n'applique pas automatiquement le blueprint (changement de
   runtime), aller dans le Dashboard → **Blueprint** → **Sync** ; vérifier
   que `school-vie-api` est bien en **Docker** avec un disque `/data`.
3. Renseigner si besoin les variables `sync: false` (`MAIL_USERNAME`,
   `MAIL_PASSORD`, `MAIL_FROM`, clés API e-mail). Les secrets JWT et le mot de
   passe MySQL sont générés automatiquement par le blueprint.
4. Récupérer le mot de passe admin généré dans les logs au premier
   démarrage (le champ `ADMIN_PASSWORD` est volontairement absent).
5. L'ancien Static Site `school-vie-app` n'est plus nécessaire : la SPA est
   servie par l'API. Mettre à jour les liens/DNS vers l'URL unique.
6. Vérifier : `curl https://school-vie-api.onrender.com/api/health`.

> **Base existante** : si vous voulez conserver la base Aiven (et ses données)
> au lieu de la base locale du conteneur, renseignez `DB_HOST`, `DB_PORT=18922`,
> `DB_USER`, `DB_PASSWORD`, `DB_SSL=true` et `DB_SKIP_CREATE_DATABASE=true`.
> L'entrypoint détecte un `DB_HOST` externe et ne démarre pas MySQL local.

---

## 4. Dépannage

| Symptôme | Cause / solution |
|---|---|
| `Variables d'environnement manquantes : DB_USER…` | Une variable obligatoire manque : voir `.env.example`. |
| `Impossible de se connecter à MySQL au démarrage` | Logs MySQL dans `/data/mysqld.log` (via `docker compose exec app cat /data/mysqld.log`). |
| Page blanche sur `/` | Vérifier que le build Vite a bien produit `frontend-dist/index.html` dans l'image. |
| Routes React en 404 | Le fallback SPA est dans `server/src/app.js` (servi uniquement si `FRONTEND_DIST_DIR` est défini). |
| Photos perdues | `UPLOADS_DIR` doit rester `/data/uploads` et le volume `/data` doit être monté. |
| Admin oublié | `FORCE_SEED=true` puis redémarrer (réinitialise le mot de passe admin). |
| Sur Render, base vidée au reboot | Pas de disque persistant attaché à `/data` (plan Free). |
