# KIS — Кабинет инвестиционной стратегии

Многоброкерская инвестиционная платформа: единый веб-клиент показывает портфель
через ядро-сервер (BFF), которое маршрутизирует запросы брокерским адаптерам.

| Документ | О чём |
|---|---|
| [vision.md](vision.md) | Видение проекта, дорожная карта |
| [arch.md](arch.md) | Архитектура: monorepo, BFF, docker, контракты |
| [BCS-SPEC.md](BCS-SPEC.md) | Спецификация API БКС (be.broker.ru) |
| [contracts/broker-api/openapi.yaml](contracts/broker-api/openapi.yaml) | Единый контракт broker-api для всех адаптеров |

## MVP v0.1 — что уже работает

**Портфель БКС в веб-клиенте.** Вы вставляете свой refresh-токен БКС в браузер —
и он остаётся только у вас (sessionStorage или localStorage+обфускация).
Ни один сервер KIS токен не хранит. Ротированный Keycloak новый токен клиент
получает обратно через заголовок `X-Rotated-Refresh-Token` и перезаписывает сам.

```
браузер (React+TS+Tailwind, токен в браузере)
   │  POST /api/v1/portfolio { broker:"bcs", refreshToken }
   ▼
core-server (Java Spring Boot, BFF)          :8080
   │  GET /v1/portfolio + заголовок X-Broker-Refresh-Token
   ▼
bcs-server (Fastify + TypeScript, адаптер)   :8081
   │  Keycloak exchange → GET /trade-api-bff-portfolio/api/v1/portfolio
   ▼
БКС be.broker.ru
```

## Структура репозитория

```
apps/
  web-client/    React 18 + TypeScript + Vite + Tailwind CSS
  core-server/   Java 17 + Spring Boot 3 (ядро/BFF/агрегатор)
  bcs-server/    Node 20 + Fastify + TypeScript (адаптер БКС)
contracts/       OpenAPI-контракты (единый broker-api для всех брокеров)
deploy/          docker-compose.yml, nginx
scripts/         up.sh (запуск), update.sh (удалённое обновление)
docs/api/        исходная документация БКС (PDF)
BCS-SPEC.md  arch.md  vision.md
```

## Требования

- **Docker Desktop** (или Docker Engine + compose plugin) — основной способ запуска;
- опционально для разработки: Node.js ≥ 20, JDK ≥ 17, Maven ≥ 3.8.

## 🚀 Быстрый старт (Docker, один шаг)

```bash
git clone git@github.com:alexvbeze-ai/project-kis.git   # или HTTPS
cd project-kis
chmod +x scripts/*.sh
./scripts/up.sh            # внутри: cd deploy && docker compose up -d --build
```

Первая сборка занимает несколько минут (скачиваются базовые образы, Maven-зависимости, npm-пакеты).

Откройте:

| URL | Что |
|---|---|
| http://localhost:8085 | **веб-клиент KIS** |
| http://localhost:8080/api/v1/health | ядро API (показывает статус брокеров) |

### Демо-режим без токена (проверить UI сразу)

Чтобы посмотреть приложение без реального брокерского токена:

```bash
KIS_MOCK_BCS=1 ./scripts/up.sh
```

`bcs-server` в этом режиме не ходит в БКС и отдаёт фиктивный портфель МосБиржи;
в форме подключения можно вставить **любую строку** как «токен».
⚠️ Никогда не включайте `KIS_MOCK_BCS=1` на публичном сервере.

### Остановка / пересборка / логи

```bash
cd deploy
docker compose down              # остановить
docker compose logs -f core-server   # логи ядра (или bcs-server / web-client)
docker compose up -d --build     # пересобрать после изменений кода
```

## 🔑 Как получить refresh-токен БКС

1. Установите приложение **«Банк БКС» (be.broker.ru)** или используйте личный кабинет трейдера.
2. Получите `refresh_token` API доступа: БКС выдаёт его для клиента `trade-api-read`
   (подробный пошаговый разбор — раздел §2 [BCS-SPEC.md](BCS-SPEC.md)).
3. На экране подключения KIS вставьте токен, выберите режим хранения:
   - **sessionStorage** (рекомендуется): токен живёт до закрытия вкладки;
   - **localStorage + обфускация**: переживает перезапуск браузера (честно: это
     не криптографическое шифрование, защита «от глаз», а не от XSS).
4. Нажмите «Подключить». Если Keycloak ротировал токен — клиент заменит его
   автоматически (заголовок `X-Rotated-Refresh-Token`).

При ошибке `UPSTREAM_UNAUTHORIZED` (401) — токен истёк/отозван: очистите его
кнопкой «Отключить токен» и вставьте новый.

## 🧑‍💻 Разработка без Docker (hot-reload)

Три терминала:

```bash
# 1) bcs-server :8081 (можно с демо-режимом)
cd apps/bcs-server && npm install
KIS_MOCK_BCS=1 npm run dev

# 2) core-server :8080
cd apps/core-server && mvn spring-boot:run

# 3) web-client :5173 (vite проксирует /api -> localhost:8080)
cd apps/web-client && npm install && npm run dev
```

Откройте http://localhost:5173.

Полезные команды:

```bash
cd apps/bcs-server && npm test          # vitest: normalize + keycloak
cd apps/bcs-server && npx tsc --noEmit  # типы
cd apps/web-client && npm run build     # tsc + vite build
cd apps/core-server && mvn -q -DskipTests package
```

## 🔄 Обновление на сервере

На машине, где проект уже развёрнут:

```bash
./scripts/update.sh
# git pull --ff-only  →  docker compose up -d --build --remove-orphans  →  docker image prune -f
```

Простой — только рестарт контейнеров (~секунды после сборки).

## Переменные окружения

| Сервис | Переменная | По умолчанию | Назначение |
|---|---|---|---|
| bcs-server | `PORT` | 8081 | HTTP-порт |
| bcs-server | `KIS_MOCK_BCS` | 0 | 1 = демо-портфель без реального БКС |
| bcs-server | `BCS_KEYCLOAK_URL`, `BCS_CLIENT_ID`, `BCS_BASE_URL` | см. [BCS-SPEC.md](BCS-SPEC.md) | точки входа БКС |
| bcs-server | `CORS_ORIGIN` | * | кто может звать адаптер (в prod — сеть compose) |
| core-server | `BCS_SERVER_URL` | http://bcs-server:8081 | адрес адаптера (compose задаёт сам) |
| web-client | `VITE_CORE_API` | /api/v1 | база ядра (dev-прокси/nginx обычно достаточно) |

Примеры: `apps/*/.env.example`. Файлы `.env*` и каталог `.ssh/` в git не попадают
(см. .gitignore).

## Безопасность (модель MVP)

- Refresh-токен существует только в браузере пользователя и транзитом через ядро;
  ни `core-server`, ни `bcs-server` не пишут его в БД/логи (логируется только sha-256 ключ кэша).
- Токены брокера никогда не коммитятся; SSH-ключи исключены из git.
- Счета в ответах маскируются (`••••1234`).
- В прод-деплое: HTTPS обязателен (токен ходит в теле POST), `bcs-server` наружу не публикуется.

## План следующих версий (кратко, детали в arch.md §9)

- **v0.2** — адаптер Т-Инвестиций (Python FastAPI) по тому же контракту;
- **v0.3** — market-data сервер (Go) + Postgres/TimescaleDB: котировки МосБиржи, история, каталог логотипов компаний;
- **v0.4** — мультиброкерская агрегация портфеля, страницы «Инвест идеи» (KIS), блоки активов, отраслевые сортировки.
