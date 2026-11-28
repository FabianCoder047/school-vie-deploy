#!/bin/sh
# =====================================================================
# Exécuté au BUILD : crée un snapshot MySQL contenant le schéma, les
# migrations et les référentiels (cycle/classes/année/paramètres).
# Les comptes admin sont ajoutés au RUNTIME par ensure-admins.js afin
# de ne jamais embarquer de mot de passe dans l'image.
# =====================================================================
set -eu

DATADIR=/build/mysql
SOCKET=/run/mysqld/bake.sock
PORT=3307
DB_NAME="${DB_NAME:-school_vie_db_004774}"
DB_USER="${DB_USER:-schoolvie}"
DB_PASSWORD="${DB_PASSWORD:-SchoolVie2026!Db}"

mkdir -p /run/mysqld /build /opt
touch /tmp/bake-mysqld.log
chown -R mysql:mysql /run/mysqld /build /tmp/bake-mysqld.log

mysqld --initialize-insecure --user=mysql --datadir="$DATADIR" >/dev/null 2>&1

mysqld --user=mysql --datadir="$DATADIR" --socket="$SOCKET" \
  --pid-file=/run/mysqld/bake.pid --bind-address=127.0.0.1 --port="$PORT" \
  --innodb_buffer_pool_size=64M --performance_schema=OFF --mysqlx=0 \
  >/tmp/bake-mysqld.log 2>&1 &

i=0
until mysqladmin --socket="$SOCKET" --protocol=socket -uroot ping --silent >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then cat /tmp/bake-mysqld.log; exit 1; fi
  sleep 1
done

mysql --socket="$SOCKET" --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

export DB_HOST=127.0.0.1 DB_PORT="$PORT" DB_USER DB_PASSWORD DB_NAME DB_SKIP_CREATE_DATABASE=true
node src/database/migrate.js
node scripts/seed-referentiels.js

mysqladmin --socket="$SOCKET" --protocol=socket -uroot shutdown >/dev/null 2>&1 || true

tar -cf /opt/db-initial.tar -C /build mysql
echo "Snapshot MySQL embarqué : $(du -h /opt/db-initial.tar | cut -f1)"
