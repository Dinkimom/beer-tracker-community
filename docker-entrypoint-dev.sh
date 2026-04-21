#!/bin/sh
set -e
cd /app
STAMP=/app/node_modules/.pnpm-lock.stamp
need_install=0
if [ ! -d node_modules/next ]; then
  need_install=1
elif [ ! -f "$STAMP" ] || ! cmp -s /app/pnpm-lock.yaml "$STAMP"; then
  need_install=1
fi
if [ "$need_install" = 1 ]; then
  echo "[docker-entrypoint-dev] pnpm install (fresh volume or lockfile changed)..."
  # Docker без TTY: иначе pnpm прерывается при пересборке node_modules (remove modules dir).
  CI=true pnpm install --frozen-lockfile
  cp /app/pnpm-lock.yaml "$STAMP"
fi
exec "$@"
