#!/bin/sh
# Starter appen. Hvis R2-opsætning er givet, gendannes/replikeres databasen via Litestream.
set -e
export DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"
if [ -n "$LITESTREAM_BUCKET" ] && [ -n "$LITESTREAM_ENDPOINT" ]; then
  litestream restore -config /app/litestream.yml -if-db-not-exists -if-replica-exists "$DATA_DIR/kapsejlads.sqlite"
  exec litestream replicate -config /app/litestream.yml -exec "node /app/server/index.mjs"
fi
echo "Ingen LITESTREAM_* variabler: kører uden persistens (data nulstilles ved genstart)."
exec node /app/server/index.mjs
