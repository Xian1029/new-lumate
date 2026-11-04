#!/bin/sh
# Linux deployment entry point. Builds the API/Web images, optionally checks
# a configured LLM, starts the stack and waits for every service to be healthy.
set -eu
set +x

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"

ENV_FILE=${LUMATE_ENV_FILE:-deploy/.env.production}
CONFIGURE=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file)
      [ "$#" -ge 2 ] || { echo 'Missing path after --env-file.' >&2; exit 2; }
      ENV_FILE=$2
      shift 2 ;;
    --configure)
      CONFIGURE=true
      shift ;;
    -h|--help)
      echo 'Usage: sh linux.sh [--env-file deploy/.env.production] [--configure]'
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

case "$ENV_FILE" in
  /*) ;;
  *) ENV_FILE="$ROOT/$ENV_FILE" ;;
esac

if [ -L "$ENV_FILE" ]; then
  echo 'Deployment configuration must be a regular file, not a symlink.' >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  if [ "$ENV_FILE" != "$ROOT/deploy/.env.production" ]; then
    echo "Configuration file does not exist: $ENV_FILE" >&2
    exit 1
  fi
  umask 077
  cp "$ROOT/deploy/.env.production.example" "$ENV_FILE"
  echo 'Created deploy/.env.production with private permissions.'
  echo 'The administrator account will use initial password 12345678 and must change it at first login.'
  echo 'Starting deployment with the generated profile. To use a public domain, set CORS_ORIGINS before starting.'
fi

command -v docker >/dev/null 2>&1 || { echo 'Docker Engine is required.' >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo 'Python 3 is required.' >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Cannot access the Docker daemon; check that Docker is running and your user has permission.' >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo 'Docker Compose v2 is required.' >&2; exit 1; }

if [ "$CONFIGURE" = true ]; then
  exec python3 "$ROOT/scripts/deploy_lumate.py" --env-file "$ENV_FILE" --configure
fi
exec python3 "$ROOT/scripts/deploy_lumate.py" --env-file "$ENV_FILE"
