# Architecture — Архитектура проекта KIS

> **KIS** — Кабинет Инвестиционной Стратегии. Документ описывает архитектуру платформы.
> Идеи и цели — в `vision.md`. Спецификация внешнего API БКС — в `BCS-SPEC.md`.
> Все брокерские серверы обязаны реализовывать единый внутренний контракт (раздел 6).
> Клиент общается **только** с BFF (core-server) и не знает о существовании брокеров.

---

## 1. Что изменилось по сравнению с «черновиком» (решения приняты)

| Вопрос | Решение | Обоснование |
|---|---|---|
| Должен ли клиент знать о брокерах? | **Нет.** Клиент ходит только на core-server (Java BFF) | Паттерн BFF: клиенту нужен *экран* («Мой портфель»), а не *брокер*. Ядро агрегирует, нормализует валюту, кэширует |
| Как запускать всё одной командой | **Docker Compose**, один файл в корне репозитория | Стандарт де-факто для локального dev и небольших серверов |
| Как обновлять удалённо | `git pull` + `docker compose up -d --build` на сервере (позже — CI/CD) | Минимальная сложность, воспроизводимость |
| Структура кода | **Monorepo**: `apps/*`, `contracts/`, `deploy/` | Единый источник контрактов, совместная разработка |
| Разные языки | Осознанное учебное допущение: каждый сервис — свой стек (см. §3) | В реальном проекте стремились бы к унификации; здесь — наоборот |

## 2. Обзор системы

Платформа состоит из пяти типов компонентов:

1. **web-client** (SPA, React+TS+Tailwind) — единственный UI. Точка входа — только core-server.
2. **core-server** (BFF, Java Spring Boot) — «мозг»: агрегация портфелей всех брокеров,
   конвертация валют, хранение пользовательских сущностей (инвест-идеи, блоки, сортировки),
   future — авторизация пользователей.
3. **Брокерские серверы-адаптеры** — по одному на брокера. Каждый реализует **единый
   внутренний контракт** (`contracts/broker-api`) и изолирует секреты брокера (refresh-токены).
4. **market-data-server** (Go) — котировки МосБиржи: сбор, кэш, история, иконки эмитентов.
   Раздаёт данные core-server'у и адаптерам.
5. **Хранилище** — PostgreSQL (+ TimescaleDB для временных рядов) с отдельными схемами
   на каждый сервис.

### 2.1 Диаграмма

```
                                ┌─────────────────────────────┐
                                │          web-client         │
                                │   React + TS + Tailwind     │
                                │   (не знает о брокерах)     │
                                └──────────────┬──────────────┘
                                               │  публичный API ядра
                                               ▼
                                ┌─────────────────────────────┐
                                │   core-server (BFF)         │
                                │   Java Spring Boot          │
                                │ • агрегация портфелей       │
                                │ • конвертация RUB/USD       │
                                │ • invest-ideas, blocks      │
                                │ • orchestrator брокеров     │
                                └───┬──────────┬──────────┬───┘
              broker-api (внутр.)   │          │          │   market-data API
        ┌───────────────┬───────────┤          │          ├───────────┐
        ▼               ▼           ▼          ▼          ▼           │
 ┌────────────┐  ┌────────────┐  ┌────────────────┐  ┌──────────────┐ │
 │ bcs-server │  │ tbank-     │  │ market-data-   │  │ gpb/vtb/sber │ │
 │ Fastify/TS │  │ server     │  │ server (Go)    │  │ ... (future) │ │
 └─────┬──────┘  │ Python     │  └──────┬─────────┘  └──────────────┘ │
       │         └─────┬──────┘         │                             │
       ▼               ▼                ▼                             ▼
 ┌──────────┐   ┌────────────┐   ┌──────────────┐          ┌──────────────────┐
 │  BCS API │   │ T-Invest   │   │ MOEX ISS API │          │  PostgreSQL +    │
 │be.broker │   │ API        │   │ + иконки     │          │  TimescaleDB     │
 └──────────┘   └────────────┘   └──────────────┘          └──────────────────┘
```

Толстые границы = сетевые вызовы. Всё в одной docker-сети `kis-net`; наружу торчат
только порты web-клиента и core-server'а.

### 2.2 Поток MVP («показать портфель БКС»)

```
browser → GET /api/v1/portfolio → core-server
core    → GET /v1/portfolio       → bcs-server (broker-api контракт)
bcs     → POST token refresh      → Keycloak БКС   (access-токен в кэше)
bcs     → GET /portfolio          → BCS API
bcs     → нормализованный JSON    → core
core    → обогащает иконками/котировками (market-data) → клиент
```

На этапе MVP, когда брокер один, core-server мог бы быть «тонким прокси», но мы сразу
строим его как полноценное ядро — чтобы добавление второго брокера не меняло клиент.

## 3. Реестр компонентов и стеки

| Сервис | Стек | Порт | Роль | Стадия |
|---|---|---|---|---|
| `web-client` | React + TypeScript + Vite + Tailwind CSS | 3000 | SPA | MVP |
| `core-server` | **Java 21 + Spring Boot 3** | 8080 | BFF, агрегация, domain-данные | MVP |
| `bcs-server` | **Node.js + TypeScript + Fastify** | 8081 | адаптер БКС | MVP |
| `market-data-server` | **Go** | 8082 | котировки MOEX, кэш, иконки | v0.3 |
| `tbank-server` | **Python + FastAPI** | 8083 | адаптер Т-Инвестиции | v0.2 |
| `gpb/vtb/sber-server` | Go / Kotlin / другой — решим позже | — | адаптеры | future |
| БД | PostgreSQL 16 + TimescaleDB | 5432 | общая, схемы по сервисам | MVP (с v0.3 активна) |

Выбор стеков — учебный: TypeScript, Java, Go, Python покрыты. Правило неизменно:
**язык может быть любым, контракт — один** (см. §6 и contract-testing в §9.4).

## 4. Веб-клиент

- **Стек:** React 18+, TypeScript (strict), Vite, Tailwind CSS, shadcn/ui (готовые
  аккуратные компоненты), TanStack Query (кэш/рефетч данных), TanStack Router или
  React Router, Recharts (графики — later), Zustand (UI-состояние).
- **Клиент говорит только с core-server** (`/api/v1/*`). Никаких URL брокеров в коде
  клиента. Даже когда брокеров станет много, экран «Портфель» остаётся одним запросом.
- **Никаких секретов в браузере:** refresh-токены, client_secret брокеров — никогда
  не попадают в клиент.
- Страницы (по roadmap): Портфель (MVP) → Инструмент/карточка акции → Инвест-идеи (KIS)
  → Настройки блоков/сортировок.
- Иконки эмитентов: `<img src="{core}/api/v1/instruments/{id}/icon">` — core проксирует
  из market-data (см. §7.4).

## 5. Core-server (Java Spring Boot) — BFF и ядро домена

Обязанности:

1. **Публичный API для клиента** (`contracts/core-api`, OpenAPI): `/api/v1/portfolio`,
   далее `/api/v1/instruments/*`, `/api/v1/ideas/*`, `/api/v1/blocks/*` и т.д.
2. **Оркестрация брокеров:** реестр подключённых брокер-адаптеров (consul-подобный
   конфиг пока в YAML), параллельные вызовы broker-api, склейка ответов.
3. **Агрегация и нормализация:** суммирование стоимости портфеля, конвертация валют
   (USD/EUR→RUB по курсу ЦБ из market-data), единый `instrumentId` (см. §7.3).
4. **Доменные данные пользователя (будущее):** инвест-идеи, блоки, сортировки,
   напоминания — хранятся в схеме `kis_core` (PostgreSQL). Это «стратегическая» часть KIS.
5. **Graceful degradation:** если bcs-server недоступен — клиент получает портфель
   остальных брокеров + поле `degradedBrokers`, а не ошибку всего экрана.
6. Позже — **собственная авторизация пользователей** (JWT), multi-tenancy: несколько
   пользователей × несколько брокеров.

Структура модулей Spring Boot: `web` (контроллеры), `domain`, `brokers` (клиенты
broker-api, сгенерированные из OpenAPI), `marketdata` (клиент market-data API),
`persistence` (JPA/Flyway-миграции).

## 6. Брокерские серверы-адаптеры и единый внутренний контракт

Каждый адаптер — самостоятельный сервис, который:

- хранит **refresh-токен своего брокера** (env/секрет-файл, том в docker);
- сам обновляет access-токен (single-flight, см. BCS-SPEC §3);
- приводит ответы брокера к **единому внутреннему контракту**;
- ничего не знает о других брокерах, о пользователе и о вебе — это чистый адаптер.

### 6.1 Broker-API контракт (внутренний, `contracts/broker-api/openapi.yaml`)

| Метод | Путь | Назначение | Стадия |
|---|---|---|---|
| GET | `/v1/health` | liveness/readiness + статус токена | MVP |
| GET | `/v1/broker` | мета: код, название, логотип, поддерживаемые фичи | MVP |
| GET | `/v1/portfolio` | позиции, деньги, инструменты | MVP |
| POST | `/v1/auth/refresh-token` | ротация/проверка refresh-токена | MVP |
| GET | `/v1/orders` | открытые заявки | reserved |
| GET | `/v1/positions` | позиции по срочному рынку | reserved |
| GET | `/v1/statements` | отчёты/справки | reserved |

Ответ `/v1/portfolio` — каноническая модель `UnifiedPortfolio` (полная схема и пример
JSON — в разделе 5 предыдущей редакции и в `contracts/`; ключевые поля):

```ts
interface UnifiedPortfolio {
  broker: string;              // "bcs" | "tbank" | ...
  asOf: string;                // ISO timestamp снимка
  accounts: Array<{
    id: string;                // маскированный номер
    type: "broker" | "iis" | "margin";
    currency: "RUB" | "USD" | "EUR" | "CNY";
    cash: number;
    lockedCash: number;
  }>;
  positions: Array<{
    instrumentId: string;      // канон: MOEX:TICKER или ISIN:...
    ticker?: string;
    isin?: string;
    quantity: number;
    avgPrice?: number;         // если брокер отдаёт
    price: number;             // последняя цена у брокера
    currency: string;
    marketValue: number;       // quantity * price
  }>;
}
```

Единый формат ошибки (`contracts/shared/error.schema.json`): `{ code, message, details }`,
коды: `UPSTREAM_UNAUTHORIZED`, `UPSTREAM_RATE_LIMIT`, `UPSTREAM_UNAVAILABLE`, `INTERNAL`.
HTTP-статусы: 401 только от брокер-адаптера внутрь (core транслирует клиенту как
«брокер требует переподключения» в теле, а не 401 всего экрана).

### 6.2 bcs-server (Fastify + TypeScript) — детали

Соответствует `BCS-SPEC.md`:

- `plugins/auth.ts` — хранение refresh-токена (env `BCS_REFRESH_TOKEN` + file-backed
  store для ротации), single-flight обновление access-токена через Keycloak
  (`POST /auth/realms/bcs/protocol/openid-connect/token`), TTL-кэш.
- `services/bcs-client.ts` — HTTP-клиент `https://be.bcs.ru` с ретраями (только
  идемпотентные GET), таймаутами, обработкой 401 → однократный refresh → повтор.
- `routes/portfolio.ts` — `GET /v1/portfolio`: вызывает BCS `GET /portfolio`
  (см. BCS-SPEC §4), мапит в `UnifiedPortfolio`, серверный TTL-кэш 30–60 c.
- `routes/system.ts` — health/broker-meta.
- Конвенция маппинга инструментов: MOEX-тикер → `MOEX:<TICKER>`, есть ISIN → дублируем.
- Кодогенерация типа клиента из OpenAPI (`openapi-typescript`) — контракт первичен.

### 6.3 Будущие адаптеры

`tbank-server` (Python FastAPI, InvestApi SDK), `gpb/vtb/sber` — те же пути контракта.
Проверка соответствия — contract tests (§9.4), а не «на глаз».

## 7. Market-data-server (Go) и справочник инструментов

### 7.1 Роль

Единственный источник рыночных данных для платформы: собирает, кэширует и хранит
историю. Остальные сервисы обращаются к нему за кэшем и «онлайном», беря нагрузку
с внешних API.

### 7.2 Источник данных — MOEX ISS

Scope: **только МосБиржа, акции российских эмитентов** (рынок `stock`, рынок
`equities`, режим `TQBR` — акционные торги). Никаких облигаций/фьючерсов/foreign
на этом этапе.

Эндпоинты ISS, которые используем:

- `GET https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities.json`
  — котировки всех акций (цена, изменение, объём);
- `.../securities/{ticker}.json` — карточка инструмента;
- `.../securities/{ticker}/candles.json` — свечи (история — later);
- `GET https://iss.moex.com/iss/statistics/engines/stock/markets/shares/candles.json` — history;
- курсы валют: `.../engines/currency/markets/selt/rates.json` (для конвертации в core).

ISS имеет собственный rate-limit (~300 запросов/мин) — поэтому кэш обязателен.

### 7.3 Канонический идентификатор инструмента

Чтобы портфели разных брокеров склеивались, вводится `instrumentId`:

- базовый: `MOEX:<TICKER>` (SBER, GAZP, LKOH…);
- резервный: `ISIN:<RU000A…>` — для инструментов без торгов на ИТЯ-режиме;
- таблица соответствия `ticker ↔ isin` строится из ISS-securities и кэшируется.

### 7.4 Иконки эмитентов (требование из bcs.ru/markets)

Страница <https://bcs.ru/markets> отображает логотипы компаний рядом с котировками.
Важно: сама страница закрыта anti-bot защитой (ServicePipe JS-challenge — проверено,
HTML не отдаётся без исполнения JS), поэтому **нельзя** просто scraping'ом скачать
ассеты со страницы, и нельзя хотлинкать их с домена БКС (hotlinking + хрупкость).

Решение — **собственный каталог иконок в market-data-server**:

1. Хранилище: `assets/icons/{SYMBOL}.svg|png` (том docker / volume `kis-icons`),
   метаданные в таблице `icons(symbol, filename, source, updated_at)`.
2. Источник по умолчанию — **ClearSPX Logo CDN** (открытый набор логотипов
   российских эмитентов, используется многими терминалами) + ручное пополнение/замена;
   при необходимости — вручную собранные SVG. Лицензионный момент фиксируем в ADR.
3. Раздача: `GET /v1/instruments/{symbol}/icon` (Go отдаёт из volume с
   `Cache-Control: public, max-age=86400`, ETag).
4. Проксирование: core-server выставляет клиенту
   `GET /api/v1/instruments/{id}/icon` — клиент не знает про market-data напрямую.
5. Fallback в UI: если иконки нет — буква тикера в цветном круге (Tailwind-компонент).

### 7.5 API (внутренний, `contracts/market-data-api`)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/v1/quotes?symbols=SBER,GAZP` | пакетные котировки из кэша |
| GET | `/v1/quotes/all?market=TQBR` | все котировки акции MOEX |
| GET | `/v1/instruments/{symbol}` | карточка + meta (isin, name, sector) |
| GET | `/v1/instruments/{symbol}/icon` | иконка эмитента |
| GET | `/v1/candles/{symbol}?tf=1d&from=&to=` | история (v0.4) |
| GET | `/v1/fx/rates` | курсы ЦБ для конвертации |

Внутреннее устройство: горутина-crawler опрашивает ISS каждые N секунд в память
(`sync.Map` + singleflight), writer складывает снапшоты в TimescaleDB (`quotes_hypertable`),
REST-слой читает из кэша. Схема БД — `kis_market`.

## 8. Данные и хранение

- **Одна PostgreSQL 16 + расширение TimescaleDB**, база `kis`, схемы:
  - `kis_core` — пользователи (later), инвест-идеи, блоки, сортировки, снимки портфелей;
  - `kis_market` — котировки (hypertable по времени), candles, instruments, icons, fx_rates;
  - у брокер-адаптеров — свои минимальные таблицы/файлы только для ротации refresh-токена
    (или env-volume, без БД вовсе на MVP).
- Миграции: Flyway (core), golang-migrate (market-data), node-pg-mirror (позже).
- Секреты: docker secrets / `.env` вне git; `.env.example` обязательны.
- Снимки портфеля: core ежедневно сохраняет `portfolio_snapshots` — это фундамент для
  графиков стратегии в будущем.

## 9. Сквозные темы

### 9.1 Monorepo

```
kis/
├── apps/
│   ├── web-client/          # React + TS + Tailwind (Vite)
│   ├── core-server/         # Java Spring Boot (Gradle)
│   ├── bcs-server/          # Fastify + TS
│   ├── market-data-server/  # Go
│   └── tbank-server/        # Python FastAPI (v0.2)
├── contracts/
│   ├── core-api/openapi.yaml        # публичный API ядра (для клиента)
│   ├── broker-api/openapi.yaml      # единый контракт адаптеров
│   ├── market-data-api/openapi.yaml
│   └── shared/*.schema.json         # UnifiedPortfolio, Error
├── deploy/
│   ├── docker-compose.yml           # вся платформа одной командой
│   ├── docker-compose.override.yml  # локальные порты/ volumes (gitignore)
│   ├── Dockerfile.*                 # по одному на сервис
│   └── nginx/                       # reverse-proxy + TLS на сервере
├── scripts/
│   ├── up.sh / down.sh / update.sh  # обёртки над compose
│   └── codegen.sh                   # генерация клиентов из contracts
├── docs/                            # BCS-SPEC.md, vision.md, arch.md, adr/
└── .github/workflows/               # CI (позже): build + contract tests
```

### 9.2 Запуск одной командой

```bash
cp .env.example .env      # вписать BCS_REFRESH_TOKEN и пр.
docker compose up -d --build
# http://localhost:3000 — клиент, http://localhost:8080 — core API
```

Compose описывает: web, core, bcs, (market-data, tbank — по мере появления), postgres.
Сеть `kis-net`, healthchecks, `depends_on: condition: service_healthy`, тома для БД
и иконок. Локально торчат только 3000/8080; на сервере — 80/443 через nginx.

### 9.3 Обновление на сервере

Принцип: **сервер — тонкий исполнитель, источник истины — git**.

```bash
ssh kis@server
cd /srv/kis && ./scripts/update.sh
# update.sh = git pull --ff-only && docker compose build && docker compose up -d
```

- Пересобираются только изменённые образы (layer caching; BuildKit cache-mounts для
  gradle/npm/go/pip).
- БД не трогаем: миграции применяются при старте сервиса (Flyway/golang-migrate),
  back-compatible by default.
- Следующий шаг (когда появится CI): GitHub Actions собирает образы в GHCR, на сервере
  `docker compose pull && up -d` — без git и сборки на самом сервере.

### 9.4 Контракты прежде всего (contract-first)

- OpenAPI в `contracts/` — единственный источник истины; клиенты и серверы генерируются
  из него: `openapi-typescript` (bcs/web), spring-openapi-generator (core),
  `oapi-codegen` (market-data), fastapi-codegen (tbank).
- **Contract tests** проверяют, что каждый адаптер на своём языке соблюдает broker-api:
  общий набор тест-кейков `contracts/tests/*.json` (вход → ожидаемая структура ответа),
  прогоняется в CI каждого сервиса (Schemathesis/Dredd или простой runner).
- Версионирование путей: `/v1/...`; breaking change = новая версия, старый контракт живёт
  transition-period.

### 9.5 Безопасность

- Refresh-токены брокеров — только в памяти/томе соответствующего адаптера, никогда
  в клиенте и логах (маскирование в логгере).
- Внутренние сервисы в приватной docker-сети; наружу — только web и core.
- CORS: core разрешает origin клиента; брокер-адаптеры CORS не включают (доступ только
  из сети).
- Rate-limit на core (Spring) и адаптерах (@fastify/rate-limit) против злоупотреблений UI.
- Позже: аутентификация в core (JWT), шифрование токенов в БД, audit-log.

### 9.6 Надёжность

- Таймауты на все внешние вызовы (connect 3s / total 10s); retry только для
  идемпотентных GET с экспоненциальным backoff; circuit breaker на адаптерах (Resilience4j
  в core).
- Graceful degradation экрана портфеля (см. §5.5).
- Health-check каждого сервиса участвует в compose healthcheck → понятный статус стека.

### 9.7 Наблюдаемость

- Структурированный JSON-лог во всех сервисах; correlation-id пробрасывается заголовком
  `X-Request-Id` от клиента сквозь core к адаптерам.
- Метрики Prometheus на каждом (/metrics), единый prometheus+grafana в compose (опц.
  профиль `monitoring`).

## 10. Эволюция архитектуры (roadmap)

| Стадия | Что появляется |
|---|---|
| **MVP (v0.1)** | web-client (портфель), core-server (BFF, один брокер через контракт), bcs-server, docker compose. Портфель БКС виден в браузере end-to-end |
| **v0.2** | tbank-server (Python) → проверка, что второй брокер добавляется без изменения клиента |
| **v0.3** | market-data-server (Go): котировки MOEX, иконки, FX; core обогащает портфель ценой/иконками, считает PnL |
| **v0.4** | Снимки портфеля в БД, графики доходности; карточка инструмента (кнопка «создать инвест-идею») |
| **v0.5 (KIS)** | Инвест-идеи: карточки (дата, целевая цена, тезис, горизонт), напоминания; блоки активов (дивидендный, роста…) с автоправилами; отраслевые и пользовательские сортировки/группировки |
| **v0.6+** | Пользовательская авторизация, мультиброкерский дашборд, алерты по ценам |

Функциональные идеи v0.5 вдохновлены существующими практиками: инвестиционные идеи
(https://bcs-express.ru/investidei) и классификация активов по блокам/отраслям —
но правила блоков и сортировки живут в core (наши), а не у брокеров.

## 11. Открытые вопросы (backlog решений, оформлять как ADR)

1. Аутентификация пользователей в core: своя (JWT) vs Keycloak — решить до v0.5.
2. Модель хранения токенов при multi-user: таблица `user_broker_credentials` в core vs
   выдача токенов адаптерам по запросу.
3. Валютная конвертация: курс ЦБ через market-data (текущий план) vs курс брокера.
4. Лицензионная чистота источника иконок (ClearSPX vs самостоятельные SVG) — ADR-0004.
5. Хранение refresh-токена БКС: env vs volume-файл с ротацией (BCS-SPEC §3.3).
6. WebSocket-обновления котировок в клиенте (пока polling через TanStack Query).

## 12. Следующий шаг (implementation order)

1. Каркас monorepo + `contracts/broker-api/openapi.yaml` + `contracts/core-api/openapi.yaml`.
2. `bcs-server` (Fastify) по BCS-SPEC: auth-refresh → portfolio → normalize (тесты на
   фикстурах).
3. `core-server` (Spring Boot): контроллер `/api/v1/portfolio` → клиент broker-api →
   Dockerfile.
4. `web-client`: Vite+Tailwind, экран «Портфель» (таблица позиций + итог), fetch к core.
5. `deploy/docker-compose.yml` + `.env.example` + `scripts/up.sh` — end-to-end прогон.
6. Параллельно: research иконок и MOEX ISS → спецификация market-data-server.
