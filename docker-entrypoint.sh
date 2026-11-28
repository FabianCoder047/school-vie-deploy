#!/bin/sh
# =====================================================================
# Orchestration du conteneur tout-en-un :
#   MySQL 8 (local) -> base/utilisateur -> migrations ->
#   seed admin ( une seule fois ) -> API + SPA sur un seul port.
#
# Une base MySQL externe (Aiven par exemple) peut être utilisée :
# renseigner DB_HOST avec une autre valeur que 127.0.0.1 / localhost.
# Dans ce cas le serveur local n'est pas démarré.
# =====================================================================
set -eu

log() { printf '[school-vie] %s\n' "$*"; }

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-school_vie_db_004774}"
DB_USER="${DB_USER:-schoolvie}"
DB_PASSWORD="${DB_PASSWORD:-SchoolVie2026!Db}"
DATADIR=/data/mysql
SOCKET=/var/run/mysqld/mysqld.sock

export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD

case "$DB_HOST" in
  127.0.0.1|localhost|'') LOCAL_DB=1 ;;
  *)                      LOCAL_DB=0 ;;
esac

shutdown_db() {
  if [ "$LOCAL_DB" = 1 ]; then
    mysqladmin --socket="$SOCKET" --protocol=socket -uroot shutdown >/dev/null 2>&1 || true
  fi
}

if [ "$LOCAL_DB" = 1 ]; then
  case "$DB_NAME" in
    *[!A-Za-z0-9_]*) log "DB_NAME ne doit contenir que lettres, chiffres et _"; exit 1 ;;
  esac
  case "$DB_USER" in
    *[!A-Za-z0-9_]*) log "DB_USER ne doit contenir que lettres, chiffres et _"; exit 1 ;;
  esac
  DB_PASSWORD_SQL=$(printf '%s' "$DB_PASSWORD" | sed "s/'/''/g")

  mkdir -p /var/run/mysqld /data/uploads
  touch /data/mysqld.log
  chown -R mysql:mysql /var/run/mysqld "$DATADIR" /data/mysqld.log

  if [ ! -d "$DATADIR/mysql" ]; then
    log "Restauration du snapshot MySQL embarqué (schéma + référentiels)"
    tar -xf /opt/db-initial.tar -C /data
    chown -R mysql:mysql "$DATADIR"
    touch /data/.seeded
  fi

  log "Démarrage de MySQL 8 (127.0.0.1:$DB_PORT)"
  mysqld --user=mysql --datadir="$DATADIR" --socket="$SOCKET" \
    --pid-file=/var/run/mysqld/mysqld.pid --bind-address=127.0.0.1 \
    --port="$DB_PORT" \
    --innodb_buffer_pool_size=64M --performance_schema=OFF --mysqlx=0 \
    >/data/mysqld.log 2>&1 &

  i=0
  until mysqladmin --socket="$SOCKET" --protocol=socket -uroot ping --silent >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then
      log "MySQL n'a pas démarré :"; cat /data/mysqld.log || true
      exit 1
    fi
    sleep 1
  done

  mysql --socket="$SOCKET" --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD_SQL}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  export DB_SKIP_CREATE_DATABASE=true
else
  log "Utilisation de la base MySQL externe $DB_HOST:$DB_PORT/$DB_NAME"
fi

# Ni migrations ni seed au réveil : le snapshot embarqué contient déjà le
# schéma et les référentiels. On garantit seulement les comptes admin et on
# lève les verrous de connexion (sans forcer de changement de mot de passe).
log "Garantie des comptes administrateurs…"
node scripts/ensure-admins.js

log "Démarrage de l'API et de la SPA sur le port ${PORT}"
node src/server.js &
APP_PID=$!

trap 'kill -TERM "$APP_PID" 2>/dev/null || true; shutdown_db' TERM INT
set +e
wait "$APP_PID"
status=$?
set -e
shutdown_db
exit "$status"
