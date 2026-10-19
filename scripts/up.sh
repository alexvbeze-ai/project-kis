#!/usr/bin/env bash
# Поднять весь стек KIS локально одной командой.
set -euo pipefail
cd "$(dirname "$0")/../deploy"
docker compose up -d --build
echo
echo "KIS MVP запущен:"
echo "  веб-клиент:   http://localhost:8085"
echo "  ядро API:     http://localhost:8080/api/v1/health"
