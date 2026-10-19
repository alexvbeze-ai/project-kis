#!/usr/bin/env bash
# Удалённое обновление проекта на сервере: pull + пересборка + рестарт без простоя сборки.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd deploy
docker compose up -d --build --remove-orphans
docker image prune -f
echo "Обновление завершено."
