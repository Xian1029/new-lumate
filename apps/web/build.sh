#!/bin/sh
set -eu
cd "$(dirname "$0")"
docker build --build-arg "NEXT_PUBLIC_API_URL=${API_UPSTREAM_URL:-http://lumate-api:8000/api}" -t "lumate-web:${IMAGE_TAG:-local}" .
