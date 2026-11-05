#!/bin/sh
# Export only tracked API/Web files; private .env files and runtime data never enter the packages.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT=${1:-"$ROOT/dist"}
mkdir -p "$OUT"
SHA=$(git -C "$ROOT" rev-parse --short HEAD)
git -C "$ROOT" archive --format=tar.gz --prefix=lumate-api/ -o "$OUT/lumate-api-$SHA.tar.gz" HEAD:apps/api
git -C "$ROOT" archive --format=tar.gz --prefix=lumate-web/ -o "$OUT/lumate-web-$SHA.tar.gz" HEAD:apps/web
printf 'API: %s\nWeb: %s\n' "$OUT/lumate-api-$SHA.tar.gz" "$OUT/lumate-web-$SHA.tar.gz"
