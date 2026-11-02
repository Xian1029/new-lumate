#!/bin/sh
# 同一入口用于本地 Docker 和 Linux 服务器。始终构建并启动 docker-compose.deploy.yml。
set -eu
set +x
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"

ENV_FILE=${LUMATE_ENV_FILE:-deploy/.env.production}
if [ "$#" -gt 0 ]; then
  case "$1" in
    --env-file)
      [ "$#" -eq 2 ] || { echo '用法: sh docker-start.sh [--env-file deploy/.env.production]' >&2; exit 2; }
      ENV_FILE=$2 ;;
    *) echo '用法: sh docker-start.sh [--env-file deploy/.env.production]' >&2; exit 2 ;;
  esac
fi

case "$ENV_FILE" in
  /*) ;;
  *) ENV_FILE="$ROOT/$ENV_FILE" ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "配置文件不存在: $ENV_FILE" >&2
  echo '先复制 deploy/.env.production.example，再按 README 填写配置。' >&2
  exit 1
fi
command -v docker >/dev/null 2>&1 || { echo '未安装 Docker。' >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo '未安装 Python 3。' >&2; exit 1; }
docker compose version >/dev/null

exec sh "$ROOT/scripts/deploy.sh" --env-file "$ENV_FILE"
