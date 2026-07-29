#!/bin/sh
set -e

# Wait for Postgres, then sync the Prisma schema (this project uses db push,
# not committed migrations). Idempotent — safe to run on every boot.
echo "[entrypoint] applying Prisma schema to the database…"
npx prisma db push --skip-generate

# Seed only when the database is empty (the seed script is idempotent/guarded).
if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "[entrypoint] seeding…"
  npm run db:seed || true
fi

echo "[entrypoint] starting: $*"
exec "$@"
