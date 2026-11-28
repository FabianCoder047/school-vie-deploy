# syntax=docker/dockerfile:1
# =====================================================================
# School Vie — image "tout-en-un" : API Express + SPA Vite + MySQL 8.
# Un seul conteneur, une seule origine, un seul port : tout démarre
# ensemble et les appels /api comme les fichiers /uploads sont servis
# par le même serveur (plus de CORS, ni de domaine d'API à synchroniser).
#
# Build local (ajouter --network=host si le réseau Docker est lent) :
#   docker build --network=host -t school-vie .
# Démarrage complet (base restaurée + comptes admin + API) :
#   docker compose up -d --build
# =====================================================================

# ---------- 1. Frontend : build Vite (PWA incluse) ----------
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
# VITE_API_URL est lu au BUILD : "/api" = appels relatifs sur la même origine.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---------- 2. Base runtime : MySQL 8 officiel + Node 20 ----------
# Les dépendances npm natives (bcrypt) sont compilées DANS cette base pour
# garantir la compatibilité ABI avec le runtime (glibc d'Oracle Linux 8).
FROM mysql:8.0 AS base
ARG NODE_VERSION=v20.20.2
RUN set -eux; \
    if command -v microdnf >/dev/null 2>&1; then \
      microdnf install -y curl xz tar ca-certificates; \
    else \
      dnf install -y curl xz tar ca-certificates; \
    fi; \
    curl -fsSLO "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz"; \
    tar -xJf "node-${NODE_VERSION}-linux-x64.tar.xz" -C /usr/local --strip-components=1; \
    rm -f "node-${NODE_VERSION}-linux-x64.tar.xz"; \
    node --version; \
    mkdir -p /data/mysql /data/uploads /var/run/mysqld; \
    chown -R mysql:mysql /data/mysql /var/run/mysqld

# ---------- 3. Backend : dépendances de production ----------
FROM base AS backend-build
WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- 4. Snapshot MySQL (schéma + référentiels, sans comptes) ----------
# Le snapshot est intégré à l'image : au réveil d'une instance Free, la base
# est restaurée à l'identique, sans relancer les migrations ni le seed.
FROM base AS db-bake
ARG DB_NAME=school_vie_db_004774
ARG DB_USER=schoolvie
ARG DB_PASSWORD=SchoolVie2026!Db
ENV DB_NAME=${DB_NAME} DB_USER=${DB_USER} DB_PASSWORD=${DB_PASSWORD}
WORKDIR /app
COPY --from=backend-build /app/server/package.json ./package.json
COPY --from=backend-build /app/server/node_modules ./node_modules
COPY server/src ./src
COPY server/scripts/seed-referentiels.js ./scripts/seed-referentiels.js
COPY scripts/bake-db.sh ./scripts/bake-db.sh
RUN chmod +x ./scripts/bake-db.sh && sh ./scripts/bake-db.sh

# ---------- 5. Image finale ----------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=5000 \
    FRONTEND_DIST_DIR=/app/frontend-dist \
    UPLOADS_DIR=/data/uploads \
    DB_HOST=127.0.0.1 \
    DB_PORT=3306 \
    DB_SSL=false \
    DB_SKIP_CREATE_DATABASE=true \
    MAIL_DRY_RUN=true

WORKDIR /app

COPY --from=backend-build /app/server/package.json ./package.json
COPY --from=backend-build /app/server/node_modules ./node_modules
COPY server/src ./src
COPY --from=frontend-build /app/client/dist ./frontend-dist
COPY --from=db-bake /opt/db-initial.tar /opt/db-initial.tar
COPY server/scripts/ensure-admins.js ./scripts/ensure-admins.js

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Base de données + uploads + marqueur de seed : tout est persistant ici.
VOLUME ["/data"]
EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=90s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
