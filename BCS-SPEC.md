# BCS Trade API — Спецификация (BCS-SPEC.md)

> **Источник истины:** `https://trade-api.bcs.ru/llms-full.txt` (полная machine-readable
> документация по стандарту llmstxt.org). Снимок сохранён в репозитории:
> `docs/api/llms-full.txt`, дата снятия: **19.10.2026**.
> Веб-справочник: <https://trade-api.bcs.ru/> (`docs/api/bcs-api-doc-link.txt`).
>
> ⚠️ Старый PDF (`docs/api/trade-api-docs.pdf`) **устарел** и больше не является источником:
> БКС изменил контракт портфеля, переименовал поля, добавил sync-версии заявок и новые WS-каналы.
> Все расхождения с PDF зафиксированы в §10 «Что изменилось относительно старого контракта».
>
> **Политика проекта:** поддержка старого API и обратных совместимостей («костылей») **удалена**.
> Код пишется строго под актуальный контракт.
>
> **Назначение документа:** точная спецификация endpoints, схем запросов/ответов, токенов,
> лимитов и ошибок — для собственного backend-for-frontend (bcs-server → core-server → web-client),
> отображающего данные портфеля.
>
> **Область MVP:** только чтение портфеля по refresh-токену
> (`Авторизация → access_token → GET /portfolio`). Остальное — справочно для расширения.

---

## 1. Общая информация

- HTTP REST endpoints: хост **`https://be.broker.ru`**, каждый сервис — под своим путём-префиксом
  (`/trade-api-keycloak`, `/trade-api-bff-portfolio`, `/trade-api-bff-limit`,
  `/trade-api-bff-operations`, `/trade-api-market-data-connector`, `/trade-api-information-service`,
  `/trade-api-bff-marginal-indicators`). В swagger-страницах paths даны без префикса
  (например `/api/v1/portfolio`) — префикс сервиса добавляется к base URL.
- WebSocket endpoints: хост **`wss://ws.broker.ru`** (те же пути-префиксы + суффикс `/ws`).
- Формат данных — JSON; `Accept: application/json`.
- Авторизация бизнес-запросов: `Authorization: Bearer <access_token>` (JWT).
- Один refresh/access токен привязан **только к одному брокерскому счёту**.
- Требуется хотя бы один брокерский счёт в «БКС Мир инвестиций».
- **Время:** все поля `dateTime` передаются в формате **UTC**; преобразование в локальное
  время — на стороне клиента.

### Сводная таблица endpoints (актуальный контракт, 19.10.2026)

| # | Сервис | Метод | URL | Права | Нужен для MVP |
|---|--------|-------|-----|-------|---------------|
| 1 | Авторизация (Keycloak) | POST | `https://be.broker.ru/trade-api-keycloak/realms/tradeapi/protocol/openid-connect/token` | — | **Да** |
| 2 | Портфель (HTTP) | GET | `https://be.broker.ru/trade-api-bff-portfolio/api/v1/portfolio` | read/write | **Да** |
| 3 | Портфель (WS) | WS | `wss://ws.broker.ru/trade-api-bff-portfolio/api/v1/portfolio/ws` | read/write | Опционально |
| 4 | Лимиты (HTTP) | GET | `https://be.broker.ru/trade-api-bff-limit/api/v1/limits` | read/write | Альтернатива |
| 5 | Лимиты (WS) | WS | `wss://ws.broker.ru/trade-api-bff-limit/api/v1/limits/ws` | read/write | — |
| 6 | Список активных заявок | GET | `.../trade-api-bff-operations/api/v1/orders` | read/write | Нет |
| 7 | Поиск заявок | POST | `.../trade-api-bff-operations/api/v1/orders/search` | read/write | Нет |
| 8 | Создать заявку | POST | `.../trade-api-bff-operations/api/v1/orders` | **write** | Нет |
| 9 | Отменить заявку | POST | `.../trade-api-bff-operations/api/v1/orders/cancel` | **write** | Нет |
| 10 | Изменить заявку | POST | `.../trade-api-bff-operations/api/v1/orders/edit` | **write** | Нет |
| 11 | Статус заявки | GET | `.../trade-api-bff-operations/api/v1/orders/{originalClientOrderId}` | read/write | Нет |
| 12 | Создать заявку (Sync) | POST | `.../trade-api-bff-operations/api/v1/orders/sync` | **write** | Нет |
| 13 | Отменить заявку (Sync) | POST | `.../trade-api-bff-operations/api/v1/orders/cancel/sync` | **write** | Нет |
| 14 | Изменить заявку (Sync) | POST | `.../trade-api-bff-operations/api/v1/orders/edit/sync` | **write** | Нет |
| 15 | Статус заявок (WS, новый) | WS | `wss://ws.broker.ru/trade-api-bff-operations/api/v1/orders/events/ws` | write | Нет |
| 16 | Сделки (история) | POST | `.../trade-api-bff-operations/api/v1/trades/search` | read/write | Нет |
| 17 | Неторговые операции | POST | `.../trade-api-bff-operations/api/v1/operations/search` | read/write | Нет |
| 18 | Исторические свечи | GET | `.../trade-api-market-data-connector/api/v1/candles-chart` | read/write | Нет |
| 19 | Обезличенные сделки | POST | `.../trade-api-market-data-connector/api/v1/last-trades` | read/write | Нет |
| 20 | Стакан | GET | `.../trade-api-market-data-connector/api/v1/order-book` | read/write | Нет |
| 21 | Котировки | POST | `.../trade-api-market-data-connector/api/v1/quotes` | read/write | Нет |
| 22 | Market Data (WS) | WS | `wss://ws.broker.ru/trade-api-market-data-connector/api/v1/market-data/ws` | read/write | Нет |
| 23 | Инструменты по ISIN | POST | `.../trade-api-information-service/api/v1/instruments/by-isins` | read/write | Нет |
| 24 | Инструменты по тикерам | POST | `.../trade-api-information-service/api/v1/instruments/by-tickers` | read/write | Нет |
| 25 | Инструменты по типу | GET | `.../trade-api-information-service/api/v1/instruments/by-type` | read/write | Нет |
| 26 | Расписание на день | GET | `.../trade-api-information-service/api/v1/trading-schedule/daily-schedule` | read/write | Нет |
| 27 | Статусы торговли | GET | `.../trade-api-information-service/api/v1/trading-schedule/status` | read/write | Нет |
| 28 | Марж. показатели (WS) | WS | `wss://ws.broker.ru/trade-api-bff-marginal-indicators/api/v1/marginal-indicators/ws` | read/write | Нет |
| 29 | Дисконты по инструментам | GET | `.../trade-api-bff-marginal-indicators/api/v1/instruments-discounts` | read/write | Нет |

---

## 2. Модель токенов и авторизация

### 2.1 Refresh-токен

- Выпускается вручную в веб-версии «БКС Мир инвестиций»:
  *Профиль → «Счета и тарифы» → выбрать счёт → «Токены API» → «Выпустить токен»*.
- Типы (права доступа):
  - **«Для торговли и чтения данных»** — рыночные/лимитные заявки на Мосбирже + чтение всего;
  - **«Только для чтения»** — цены, портфель, исторические данные; заявки создавать нельзя.
- Срок жизни: **90 суток**. Показывается **один раз**, система его не хранит.
- Удаление refresh-токена:
  - «только чтение» — выданный access-токен живёт до конца своих 24 ч;
  - «торговля» — access-токены аннулируются практически мгновенно.
- Количество одновременных токенов не ограничено; каждый привязан к одному счёту.

### 2.2 Access-токен

- Получается обменом refresh-токена (ниже). Срок жизни **24 часа** (`expires_in = 86400`).
- Используется как `Authorization: Bearer <access_token>` во всех остальных запросах,
  включая handshake WebSocket.

### 2.3 Endpoint: Получение access-токена

```
POST https://be.broker.ru/trade-api-keycloak/realms/tradeapi/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded
Accept: application/json
```

**Запрос (body-параметры, обязательны все три):**

| Параметр | Тип | Описание |
|---|---|---|
| `client_id` | enum | `trade-api-read` (токен «чтение») / `trade-api-write` (торговый) |
| `refresh_token` | string | Значение refresh-токена из веб-версии |
| `grant_type` | enum | Всегда `refresh_token` |

**Ответ 200 (JSON):**

| Поле | Тип | Описание |
|---|---|---|
| `access_token` | string | JWT с запрошенными правами |
| `expires_in` | number | Время жизни access-токена, сек (24 ч) |
| `refresh_expires_in` | number | Время жизни refresh-токена (90 суток) |
| `refresh_token` | string | **Новый** refresh-токен (пара access/refresh обновляется) |
| `token_type` | string | Всегда `bearer` |
| `not-before-policy` | string | UNIX-время действия токенов (обычно `0`) |
| `session_state` | string | GUID сессии |
| `scope` | string | Права доступа согласно переданному токену |

> В swagger `expires_in`/`refresh_expires_in` объявлены как числа; фактический Keycloak
> может отдавать строки — парсить оба варианта.

**Ответ 400 (Invalid grant):** `{ "error": "invalid_grant", "error_description": "..." }` —
refresh-токен недействителен/истёк/удалён либо перепутан client_id (read vs write).

> ⚠️ **Ротация:** ответ содержит новый `refresh_token`. Сохранять/перезаписывать его после
> каждого обмена (в MVP токен живёт в браузере пользователя и возвращается ему через поле
> `rotatedRefreshToken` ответа адаптера).

---

## 3. MVP: Получение портфеля

### 3.1 Endpoint: Портфель (HTTP)

```
GET https://be.broker.ru/trade-api-bff-portfolio/api/v1/portfolio
Authorization: Bearer <access_token>
Accept: application/json
```

Параметров нет. Доступен токеном «только чтение».

Альтернативный транспорт (стриминг обновлений портфеля, тот же сервис):

```
wss://ws.broker.ru/trade-api-bff-portfolio/api/v1/portfolio/ws
Authorization: Bearer <access_token>   (заголовок при handshake)
```

### 3.2 Ответ: структура (АКТУАЛЬНЫЙ КОНТРАКТ)

Корень ответа 200 — **голый JSON-массив** объектов `Portfolio` (без обёртки
`{ positions: [...] }` из старого PDF). Схема элемента (title `Portfolio`):

| Поле | Тип | Описание |
|---|---|---|
| `type` | enum | Тип позиции: `moneyLimit` \| `depoLimit` \| `futuresLimit` \| `futuresHolding` \| `otcLimit` |
| `subAccountId` | uuid | ID субсчета — **deprecated** |
| `agreementId` | uuid | ID генерального соглашения — **deprecated** |
| `account` | string | Торговый счет |
| `exchange` | string | Код биржи |
| `ticker` | string | Тикер инструмента |
| `displayName` | string | Наименование инструмента |
| `baseAssetTicker` | string | Тикер базового актива |
| `currency` | string | Валюта цены |
| `upperType` | enum | Верхнеуровневый тип: `CURRENCY` \| `RUSSIA` \| `FOREIGN` \| `OTC` |
| `instrumentType` | string | Тип инструмента |
| `term` | enum | Срок расчётов: `T0` \| `T1` \| `T2` \| `T365` |
| `quantity` | number | Количество (шт.) |
| `locked` | number | Занято под активные заявки или ГО |
| `balancePrice` | number | Балансовая цена в валюте цены |
| `currentPrice` | number | Текущая цена |
| `balanceValue` | number | Балансовая стоимость в валюте цены |
| `balanceValueRub` | number | Балансовая стоимость в рублях |
| `balanceValueUsd` | number | Балансовая стоимость в долларах |
| `balanceValueEur` | number | Балансовая стоимость в евро |
| `currentValue` | number | Текущая стоимость в валюте цены |
| `currentValueRub` | number | Текущая стоимость в рублях *(было `currentUserValueRub`)* |
| `currentValueUsd` | number | Текущая стоимость в долларах *(было `currentUserValueUsd`)* |
| `currentValueEur` | number | Текущая стоимость в евро *(было `currentUserValueEur`)* |
| `unrealizedPL` | number | Изменение цены с момента открытия позиции |
| `unrealizedPercentPL` | number | То же, % |
| `dailyPL` | number | Дневное изменение |
| `dailyPercentPL` | number | Дневное изменение, % |
| `portfolioShare` | number | Доля в портфеле, % (от рублевой стоимости) |
| `scale` | int32 | Количество знаков |
| `minimumStep` | number | Минимальный шаг цены |
| `board` | string | Код класса ценной бумаги (напр. `TQBR`) |
| `priceUnit` | string | Единица цены |
| `faceValue` | number | Номинал (облигации) |
| `accruedIncome` | number | НКД (облигации) |
| `logoLink` | string | Ссылка на логотип |
| `isBlocked` | boolean | Признак блокированного класса |
| `isBlockedTradeAccount` | boolean | Заблокирован ли торговый счёт |
| `lockedForFutures` | number | Занято под ГО по фьючерсам |
| `ratioQuantity` | number | Количество в лоте |
| `expireDate` | string | Дата экспирации |

Деньги определяются по `type == "moneyLimit"` (или `upperType == "CURRENCY"`); у денежной
строки `quantity` — сумма в валюте цены.

Enum `instrumentType` (по справочнику `/api/v1/instruments/*`, значения те же и в позициях):
`CURRENCY | STOCK | FOREIGN_STOCK | BONDS | NOTES | DEPOSITARY_RECEIPTS | EURO_BONDS |
MUTUAL_FUNDS | ETF | FUTURES | OPTIONS | GOODS | INDICES`.
В портфеле также встречаются коды классов расчётов (`TCS`, `ACRN`, …) — классификация
позиций выполняется с fallback по `board`/`faceValue`/`accruedIncome` (см. §3.4).

### 3.4 ⚠️ Дубли позиций: один инструмент = несколько записей (подтверждено на проде)

**Симптом:** API возвращает котировки позиций не в одном экземпляре — у пользователя
каждая позиция продублирована ×4.

**Причина по документации:** ответ портфеля — это **сырые остатки/depoLimit-записи биржи**,
сгруппированные брокером по ключу
`(account, exchange, ticker, board, term, currency)` (в старом контракте — по субсчетам,
deprecated `subAccountId`). Один инструмент даёт несколько строк, потому что:

1. **`term` (срок расчётов)** — позиции T0/T1/T2/T365 никогда не сливаются между собой
   (режимы торгов: Т0-премиум, обычные T1-расчёты, ночные сделки и т.п.);
2. **разные `board`/секции** одной биржи (TQBR, FCPR, GLDR, …);
3. **несколько счетов** пользователя (брокерский + ИИС) — разные `account`;
4. **locked-часть**: количество, занятое под активные заявки (`locked`), может идти
   отдельной записью от свободной части позиции.

**Правило отображения (обязательно для всех клиентов ядра):** перед выводом позиции
**агрегировать** строки по `(account, exchange, ticker, currency)`:

| Поле | Как агрегировать |
|---|---|
| `quantity`, `locked`, `lockedForFutures`, `ratioQuantity` | сумма |
| `balanceValue(Rub)`, `currentValue(Rub/Usd/Eur)`, `balanceValue` в валюте цены | сумма |
| `unrealizedPL`, `dailyPL` | сумма |
| `avgPrice/balancePrice` | Σ(quantity·price)/Σquantity (взвешенная по количеству) |
| `currentPrice`, `scale`, `minimumStep`, `faceValue`, `accruedIncome` | взять из записи с максимальной стоимостью |
| `portfolioShare`, `unrealizedPercentPL`, `dailyPercentPL` | пересчитать после агрегации |

Агрегация выполнена в bcs-server (`normalize.ts::aggregateByInstrument`) — ядро и клиент
получают уже единый набор позиций по одному инструменту на строку.

### 3.5 Ошибки endpoint'а «Портфель»

Документированный ответ ошибки (429 и другие 4xx/5xx) — объект `ErrorResponse`:

```json
{
  "timestamp": 0,
  "traceId": "string",
  "type": "VALIDATION_ERROR | RESOURCE_EXHAUSTED | USER_BLOCKED | BAD_REQUEST | NOT_FOUND | UNAUTHORIZED | FORBIDDEN | CONFLICT | INTERNAL_SERVER_ERROR | SESSION_NOT_FOUND_ERROR | SESSION_EXPIRED_ERROR | SESSION_FAILED_ERROR",
  "errors": [ { "type": "string", "field": "string", "payload": {} } ],
  "displayOptions": {}
}
```

| HTTP | type | Смысл для адаптера |
|---|---|---|
| 401 | `UNAUTHORIZED` | access отклонён → переобмен refresh, 1 retry |
| 429 | `RESOURCE_EXHAUSTED` | rate limit → UPSTREAM_RATE_LIMIT, backoff |
| прочее 4xx/5xx | см. enum | пробросить статус и `type`/traceId в логи |

### 3.6 Целевой поток MVP-сервера

```
[refresh_token в браузере пользователя]
        │  POST keycloak token (client_id=trade-api-read, grant_type=refresh_token)
        ▼
[access_token (24ч)] ──кэш, обновление по expires_in / при 401──┐
        │  GET /trade-api-bff-portfolio/api/v1/portfolio         │
        ▼                                                        │
[Portfolio[] (голый массив)] → normalizePortfolio → UnifiedPortfolio → web-client ◄┘
   (REST-поллинг; позже — WS .../portfolio/ws)
```

Правила для сервера:
1. Refresh-токен не хранится на сервере (MVP: живёт в браузере, проксируется заголовком
   `X-Broker-Refresh-Token`); ротированный возвращается клиенту в `rotatedRefreshToken`.
2. Кэшировать access-токен; при истечении или 401 — переобмен и повтор запроса (1 retry).
3. После обмена сохранять присланный новый `refresh_token`.
4. Для MVP достаточно прав «только чтение» (`client_id=trade-api-read`).

---

## 4. Альтернатива: Портфель через сервис «Лимиты»

```
GET https://be.broker.ru/trade-api-bff-limit/api/v1/limits
WS: wss://ws.broker.ru/trade-api-bff-limit/api/v1/limits/ws
```

Корень 200 — объект с контейнерами `depoLimit[]`, `futureHolding[]`, `moneyLimits[]`,
`futuresLimits[]` (схема совпадает со старой §4 PDF; ключи денег/лимитов ФОРТС —
во множественном числе: `moneyLimits`, `futuresLimits`). Основные поля:

- `depoLimit[]`: `ticker`, `classCode`, `exchange`, `averagePrice`,
  `quantity{type,value}` (штуки), `quantityBatch{type,value}` (лоты), `instrumentType`,
  `loadDate`, `lockedBuyValue`, `lockedSellValue`, `lockedBuyQuantity`, `lockedSellQuantity`.
- `futureHolding[]`: `ticker`, `classCode`, `exchange`, `cbplPlanned`, `varMargin`,
  `positionValue`, `totalNet`, `executionDate`, `totalVarMargin`, `realVarMargin`,
  `averagePrice`, `instrumentType`, `tradeDate`.
- `moneyLimits[]`: `exchange`, `currencyCode`, `locked`, `averagePrice`, `instrumentType`,
  `quantity{type,value}`, `loadDate`.
- `futuresLimits[]`: `currencyCode`, `exchange`, `accruedint`, `cbpLimit`, `cbplUsed`,
  `cbplPlanned`, `cbplUsedForOrders`, `cbplUsedForPositions`, `optionsPremium`,
  `instrumentType`, `loadDate`, `varMargin`, `realVarMargin`.

---

## 5. Справочно (вне MVP): торговые операции (write-токен)

Сервис `trade-api-bff-operations`. Актуальные методы:

- `POST /api/v1/orders` — создать заявку; `POST /api/v1/orders/sync` — синхронная версия.
- `POST /api/v1/orders/cancel` — отмена по идентификатору (поддерживаются статусы 0, 1, 5, 10);
  `POST /api/v1/orders/cancel/sync` — синхронная версия.
- `POST /api/v1/orders/edit` — изменение; `POST /api/v1/orders/edit/sync` — синхронная версия.
- `GET /api/v1/orders` — список активных заявок; `POST /api/v1/orders/search` — поиск заявок;
  `GET /api/v1/orders/{originalClientOrderId}` — статус заявки.
- WS статусов заявок (актуальный канал): `wss://ws.broker.ru/trade-api-bff-operations/api/v1/orders/events/ws`.
- История сделок: `POST /api/v1/trades/search` — только сделки начиная с **26.01.2026**,
  не более **1000** последних.
- Неторговые операции: `POST /api/v1/operations/search` — лимит **3 RPS**.

---

## 6. Справочно (вне MVP): market data

Сервис `trade-api-market-data-connector`:

- `GET /api/v1/candles-chart` — исторические свечи; максимум **1440 баров** на запрос
  (при превышении — ошибка; дробите интервал или укрупняйте `timeFrame`).
- `POST /api/v1/last-trades` — обезличенные сделки; `GET /api/v1/order-book` — стакан;
  `POST /api/v1/quotes` — текущие котировки.
- WS (единый коннектор): `wss://ws.broker.ru/trade-api-market-data-connector/api/v1/market-data/ws`
  — каналы: последняя свеча, стакан, котировки (`dataType=3`), обезличенные сделки
  (`dataType=2`), подписки ≤ 100 инструментов на соединение.

---

## 7. Справочно (вне MVP): information service

Сервис `trade-api-information-service`:

- `POST /api/v1/instruments/by-isins`, `POST /api/v1/instruments/by-tickers`,
  `GET /api/v1/instruments/by-type` — справочник инструментов (`Instrument`: `ticker`,
  `boards[{classCode,exchange}]`, `isin`, `type/instrumentType` ∈ `CURRENCY, STOCK,
  FOREIGN_STOCK, BONDS, NOTES, DEPOSITARY_RECEIPTS, EURO_BONDS, MUTUAL_FUNDS, ETF, FUTURES,
  OPTIONS, GOODS, INDICES`, `lotSize`, `scale`, `minimumStep`, …; `promoIdx`, `logoLink`,
  `cfi` — deprecated).
- `GET /api/v1/trading-schedule/daily-schedule` — расписание на день
  (`isWorkDay`, `dailySchedule[{startDate,endDate,tradingSessionType,tradingSessionStatus}]`).
- `GET /api/v1/trading-schedule/status` — текущий торговый статус
  (`tradingSessionStatus: OPEN|CLOSE`, `nextSessionDate`).

---

## 8. Справочно (вне MVP): маржинальные показатели и дисконты

Сервис `trade-api-bff-marginal-indicators`:

- WS: `wss://ws.broker.ru/trade-api-bff-marginal-indicators/api/v1/marginal-indicators/ws`
  — ГО, вармаржа, уровень риска, задолженности, устойчивость счёта.
- `GET /api/v1/instruments-discounts` — ставки дисконтов (`ticker`, `discountLong`, `discountShort`).

---

## 9. Ограничения (rate limits)

Ограничения задаются отдельно для HTTP и WebSocket; при превышении — **429 Too Many Requests**
(тело — `ErrorResponse` c `type=RESOURCE_EXHAUSTED`). Рекомендация БКС: обработка 429 и
повторы с **экспоненциальной задержкой**.

### HTTP (на счёт клиента)

| Сервис | Лимит | Доп. ограничение |
|---|---|---|
| Портфель | 10 RPS | — |
| Лимиты | 10 RPS | — |
| Справочник (instruments) | 10 RPS | — |
| Заявки | 10 RPS | 200 000 заявок/сутки |
| Сделки | 10 RPS | — |
| Статус заявки | 10 RPS | — |
| Дисконты | 10 RPS | — |
| Рыночные данные | 10 RPS | candles-chart ≤ 1440 баров/запрос |
| Неторговые операции | **3 RPS** | — |

### WebSocket

| Сервис | Соединений | Сообщений/сек от клиента | Подписок в соединении | Объём сообщения |
|---|---|---|---|---|
| Портфель | 2 | 10 | — | 8 КБ |
| Лимиты | 2 | 10 | — | 8 КБ |
| Заявки | 4 | 10 | — | 8 КБ |
| Марж. показатели | 2 | 10 | — | 8 КБ |
| Рыночные данные | 20 | 10 | 100 инструментов | 8 КБ |

Heartbeat: сервер шлёт `ping` каждые 30 с; без `pong` соединение закрывается.

---

## 10. Что изменилось относительно старого контракта (PDF)

1. **Портфель:** корень ответа — голый массив `Portfolio[]` вместо `{ positions: [] }`.
2. **Переименованы поля:** `currentUserValueRub/Usd/Eur` → `currentValueRub/Usd/Eur`;
   `priceUnit` теперь string; `subAccountId`/`agreementId` — deprecated (uuid).
3. **Enum'ы зафиксированы:** `type` ∈ `moneyLimit|depoLimit|futuresLimit|futuresHolding|otcLimit`;
   `upperType` ∈ `CURRENCY|RUSSIA|FOREIGN|OTC`; `term` ∈ `T0|T1|T2|T365`.
4. **Заявки:** появились sync-версии (`orders/sync`, `orders/cancel/sync`, `orders/edit/sync`)
   и новые bulk-методы (`orders/cancel`, `orders/edit`, `orders/search`); старые пути
   `POST/DELETE /orders/{id}` и `POST /orders/{id}/cancel`, `POST /orders/{id}` (edit) помечены
   устаревшими.
5. **WS статуса заявок:** актуальный канал `orders/events/ws`; каналы `orders/execution/ws`
   и `orders/transaction/ws` — устаревшие.
6. **История сделок:** отдаются только сделки с 26.01.2026, максимум 1000.
7. **Свечи:** жёсткое ограничение 1440 баров на запрос.
8. **Единый ErrorResponse** (`timestamp:int64, traceId, type enum, errors[], displayOptions`)
   для всех сервисов; Keycloak-ошибка обмена токена — отдельный формат
   (`error=invalid_grant`).
9. **MCP:** БКС официально поддерживает подключение LLM-клиентов через MCP-коннектор
   (`trade-api.bcs.ru/#/mcp`) с refresh-токеном — справочно, наш стек не зависит.

**Правило кода:** адаптер (`apps/bcs-server`) реализует только новый контракт; fallback'ы на
старый формат удалены. При несовпадении структуры ответа адаптер пишет первые 500 символов
реального тела в лог (`[bcs-api] portfolio …`) и поднимает `UPSTREAM_UNAVAILABLE` с этим
фрагментом в details.

---

## 11. Политика обновления портфеля на клиенте (web-client)

Портфель — «экран для раздумий», а не источник онлайн-котировок. Постоянный поллинг
запрещён (лимит БКС 10 RPS — §9, но бережём квоту и батарею):

1. **Автообновление по умолчанию выключено** (`refreshMs = 0`, localStorage-ключ
   `kis.portfolio.refreshIntervalMs`). Интервал выбирается в панели настроек:
   30 с / 1 / 5 / 15 мин / 1 час.
2. **Ручное обновление** — иконка ⟳ в шапке; загрузка портфеля также выполняется при
   открытии/перезагрузке страницы (один запрос).
3. **Тема UI** (светлая/тёмная, Tailwind `darkMode:"class"`) — там же в настройках,
   ключ `kis.theme`; анти-FOUC-скрипт в `index.html` применяет тему до первой отрисовки.
4. **Управление токеном** («Обновить токен…» / «Отключить токен») — в панели настроек;
   красных кнопок в шапке нет.
