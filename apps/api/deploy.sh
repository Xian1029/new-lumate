#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo '请先复制 .env.example 为 .env，并配置与现有数据一致的 ENCRYPTION_KEY、JWT_SECRET_KEY、CSRF_SECRET_KEY。' >&2
  exit 1
fi
for key in ENCRYPTION_KEY JWT_SECRET_KEY CSRF_SECRET_KEY; do
  value=$(sed -n "s/^${key}=//p" .env | tail -n 1)
  if [ -z "$value" ]; then
    echo "缺少 $key；为保护已有数据，部署已停止。" >&2
    exit 1
  fi
done
docker network inspect lumate-network >/dev/null 2>&1 || docker network create lumate-network >/dev/null
for volume in lumate-customized_data lumate-customized_uploads lumate-customized_redis; do
  docker volume inspect "$volume" >/dev/null 2>&1 || docker volume create "$volume" >/dev/null
done
docker compose --env-file .env -f compose.yml up -d --build --wait
