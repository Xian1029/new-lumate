#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo '请先复制 .env.example 为 .env，并设置 API_UPSTREAM_URL 与 WEB_PORT。' >&2
  exit 1
fi
docker network inspect lumate-network >/dev/null 2>&1 || docker network create lumate-network >/dev/null
docker compose --env-file .env -f compose.yml up -d --build --wait
