#!/bin/sh
set -e

DB_PATH="${DB_PATH:-/data/signal.db}"
mkdir -p "$(dirname "$DB_PATH")"

if [ -n "${LITESTREAM_ACCESS_KEY_ID:-}" ]; then
  if [ ! -f "$DB_PATH" ]; then
    echo "restoring database from replica"
    litestream restore -if-replica-exists -config /etc/litestream.yml "$DB_PATH"
  fi

  alembic upgrade head
  [ "${SEED_ON_BOOT:-false}" = "true" ] && python -m app.seed

  echo "starting under litestream replication"
  exec litestream replicate -config /etc/litestream.yml -exec \
    "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
fi

echo "no replica configured; running without replication"
alembic upgrade head
[ "${SEED_ON_BOOT:-false}" = "true" ] && python -m app.seed

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
