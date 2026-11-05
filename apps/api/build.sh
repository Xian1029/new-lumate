#!/bin/sh
set -eu
cd "$(dirname "$0")"
docker build --build-arg "PYTHON_REQUIREMENTS=${API_PYTHON_REQUIREMENTS:-requirements-core.txt}" -t "lumate-api:${IMAGE_TAG:-local}" .
