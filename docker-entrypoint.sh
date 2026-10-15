#!/bin/sh
set -e

# Si la variable AUTO_MIGRATE está en true, ejecuta migraciones antes de iniciar la app
if [ "$AUTO_MIGRATE" = "true" ]; then
  echo "🚀 [Cloud Run] Ejecutando prisma migrate deploy..."
  npx prisma migrate deploy
fi

exec "$@"
