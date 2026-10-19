# BCS Trade API — Спецификация (BCS-SPEC.md)

> Источник: `docs/api/trade-api-docs.pdf` («Инструкция по использованию API БКС», 103 стр.)
> и веб-справочник: <https://trade-api.bcs.ru/> (файл `docs/api/bcs-api-doc-link.txt`).
>
> Назначение документа: точная спецификация endpoints, схем запросов/ответов, токенов и
> ошибок — для написания собственного сервера (backend-for-frontend), который в собственном
> веб-клиенте отображает данные портфеля.
>
> **Область MVP проекта:** только чтение портфеля по refresh-токену
> (`Авторизация → access_token → GET /portfolio`). Остальные endpoints задокументированы
> как справочный материал для будущего расширения.

---

## 1. Общая информация

- Все HTTP REST endpoints находятся на хосте **`https://be.broker.ru`**, каждый сервис —
  под своим путём-префиксом (`/trade-api-*`).
- Все WebSocket (стриминг) endpoints — на хосте **`wss://ws.broker.ru`**.
- Формат данных — JSON.
- Авторизация бизнес-запросов — заголовок `Authorization: Bearer <access_token>` (JWT).
- Один refresh/access токен привязан **только к одному брокерскому счёту**; доступ к
  портфелю другого счёта этим токеном невозможен.
- Для работы через API нужен хотя бы один брокерский счёт в «БКС Мир инвестиций».

### Сводная таблица endpoints

| # | Сервис | Метод | URL | Права | Нужен для MVP |
|---|--------|-------|-----|-------|---------------|
| 1 | Авторизация (Keycloak) | POST | `https://be.broker.ru/trade-api-keycloak/realms/tradeapi/protocol/openid-connect/token` | — | **Да** |
| 2 | Портфель (HTTP) | GET | `https://be.broker.ru/trade-api-bff-portfolio/api/v1/portfolio` | read/write | **Да** |
| 3 | Портфель (WS) | WS | `wss://ws.broker.ru/trade-api-bff-portfolio/api/v1/portfolio/ws` | read/write | Опционально (стриминг портфеля) |
| 4 | Лимиты (HTTP) | GET | `https://be.broker.ru/trade-api-bff-limit/api/v1/limits` | read/write | Альтернатива портфелю |
| 5 | Лимиты (WS) | WS | `wss://ws.broker.ru/trade-api-bff-limit/api/v1/limits/ws` | read/write | — |
| 6 | Создание заявки | POST | `https://be.broker.ru/trade-api-bff-operations/api/v1/orders` | **write** | Нет |
| 7 | Изменение заявки | POST | `https://be.broker.ru/trade-api-bff-operations/api/v1/orders/{originalClientOrderId}` | **write** | Нет |
| 8 | Отмена заявки | POST | `https://be.broker.ru/trade-api-bff-operations/api/v1/orders/{originalClientOrderId}/cancel` | **write** | Нет |
| 9 | Статус заявки | GET | `https://be.broker.ru/trade-api-bff-operations/api/v1/orders/{originalClientOrderId}` | read/write | Нет |
| 10 | Стриминг статусов заявок | WS | `wss://ws.broker.ru/trade-api-bff-operations/api/v1/orders/transaction/ws` | write | Нет |
| 11 | Стриминг исполнений | WS | `wss://ws.broker.ru/trade-api-bff-operations/api/v1/orders/execution/ws` | write | Нет |
| 12 | Стакан (WS) | WS | `wss://ws.broker.ru/trade-api-market-data-connector/api/v1/market-data/ws` | read/write | Нет |
| 13 | Котировки (WS) | WS | тот же `market-data/ws`, `dataType=3` | read/write | Нет |
| 14 | Обезличенные сделки (WS) | тот же `market-data/ws`, `dataType=2` | WS | read/write | Нет |
| 15 | Последняя свеча (WS) | тот же `market-data/ws`, `dataType=1` | WS | read/write | Нет |
| 16 | Исторические свечи | GET | `https://be.broker.ru/trade-api-market-data-connector/api/v1/candles-chart` | read/write | Нет |
| 17 | Поиск инструмента по тикерам | POST | `https://be.broker.ru/trade-api-information-service/api/v1/instruments/by-tickers` | read/write | Нет |
| 18 | Поиск инструмента по типу | GET | `https://be.broker.ru/trade-api-information-service/api/v1/instruments/by-type` | read/write | Нет |
| 19 | Расписание инструмента | GET | `https://be.broker.ru/trade-api-information-service/api/v1/trading-schedule/daily-schedule` | read/write | Нет |
| 20 | Торговый статус инструмента | GET | `https://be.broker.ru/trade-api-information-service/api/v1/trading-schedule/status` | read/write | Нет |
| 21 | Маржинальные показатели (WS) | WS | `wss://ws.broker.ru/trade-api-bff-marginal-indicators/api/v1/marginal-indicators/ws` | read/write | Нет |
| 22 | Дисконты | GET | `https://be.broker.ru/trade-api-bff-marginal-indicators/api/v1/instruments-discounts` | read/write | Нет |

---

## 2. Модель токенов и авторизация

### 2.1 Refresh-токен

- Выпускается вручную пользователем в веб-версии «БКС Мир инвестиций»:
  *Профиль → Управление счетами → выбрать брокерский счёт → «Токены API» → «Выпустить токен»*.
- Типы refresh-токенов (права доступа):
  - **«Для торговли и чтения данных»** — может создавать рыночные/лимитные заявки на Мосбирже + читать всё;
  - **«Только для чтения»** — анализ цен, портфель, исторические данные; создавать заявки нельзя.
- Срок жизни refresh-токена: **90 суток**. Токен показывается один раз, система его не хранит.
- Удаление refresh-токена в веб-версии:
  - для «только чтение» — выпущенный access-токен живёт до конца своих 24 ч;
  - для «торговля» — инвалидация access-токенов в течение нескольких минут.
- Количество одновременных токенов не ограничено; каждый токен привязан к одному счёту.

### 2.2 Access-токен

- Получается из refresh-токена запросом ниже (стандартный OAuth2/Keycloak, JWT).
- Срок жизни access-токена: **24 часа** (`expires_in = 86400`), затем нужно перевыпустить.
- Используется как `Authorization: Bearer <access_token>` во всех остальных запросах.

### 2.3 Endpoint: Получение access-токена

```
POST https://be.broker.ru/trade-api-keycloak/realms/tradeapi/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded
```

**Запрос (body-параметры, каждый ровно один раз):**

| Параметр | Где | Тип | Обязат. | Описание |
|---|---|---|---|---|
| `client_id` | body | string | да | `"trade-api-read"` — для токена «только чтение»; `"trade-api-write"` — для торгового токена |
| `refresh_token` | body | string | да | Значение refresh-токена из веб-версии |
| `grant_type` | body | string | да | Всегда `"refresh_token"` |

**Ответ (JSON):**

| Поле | Тип | Обязат. | Описание |
|---|---|---|---|
| `access_token` | string | да | JWT-токен с запрошенными правами |
| `expires_in` | string* | да | Время жизни access-токена в секундах (всего 24 часа) |
| `refresh_expires_in` | string* | да | Время жизни refresh-токена (всего 90 суток) |
| `refresh_token` | string | да | Новый refresh-токен (для обновления пары access/refresh) |
| `token_type` | string | да | Всегда `"bearer"` |
| `not-before-policy` | string* | да | UNIX-время, с которого действуют токены (обычно `0` — сразу) |
| `session_state` | string | да | GUID сессии |
| `scope` | string | да | Права доступа согласно переданному токену |

\* В документации тип указан как «Строка»; фактически Keycloak возвращает числа —
сервер должен парсить оба варианта (число или строка).

> ⚠️ **Важно для сервера:** ответ содержит **новый `refresh_token`**. Рекомендуется
> ротировать сохранённый refresh-токен (перезаписывать секрет) после каждого обмена,
> чтобы не потерять доступ.

**Пример запроса (curl):**

```bash
curl -X POST https://be.broker.ru/trade-api-keycloak/realms/tradeapi/protocol/openid-connect/token \
  -d "client_id=trade-api-read" \
  -d "grant_type=refresh_token" \
  --data-urlencode "refresh_token=<REFRESH_TOKEN>"
```

---

## 3. MVP: Получение портфеля

### 3.1 Endpoint: Портфель (HTTP)

```
GET https://be.broker.ru/trade-api-bff-portfolio/api/v1/portfolio
Authorization: Bearer <access_token>
```

Параметры запроса: только заголовок `Authorization` (string, обязателен).
Query/path-параметров нет. Доступен и токеном «только чтение».

Альтернативный транспорт (тот же сервис, стриминг обновлений портфеля):

```
wss://ws.broker.ru/trade-api-bff-portfolio/api/v1/portfolio/ws
Authorization: Bearer <access_token>   (заголовок при handshake)
```

### 3.2 Ответ: структура

Корень ответа — объект с единственным контейнером:

| Поле | Тип | Обязат. | Описание |
|---|---|---|---|
| `positions` | array | да | Позиции в портфеле (по одному брокерскому счёту, к которому привязан токен) |

Элемент массива `positions[]` — объект со следующими полями (**все поля обязательны**):

| Поле | Тип | Описание |
|---|---|---|
| `type` | string | Тип позиции |
| `subAccountId` | string | id субсчета |
| `agreementId` | string | id генерального соглашения (совпадает с номером брокерского счёта) |
| `account` | string | Торговый счёт |
| `exchange` | string | Биржа |
| `ticker` | string | Биржевой тикер инструмента |
| `displayName` | string | Наименование инструмента |
| `baseAssetTicker` | string | Тикер базового актива |
| `currency` | string | Валюта цены |
| `expireDate` | date | Дата экспирации |
| `upperType` | string | Верхнеуровневый тип инструмента |
| `instrumentType` | string | Тип инструмента |
| `term` | string | Тип лимита (T0/T1/T2/T365) |
| `quantity` | number | Количество (шт.) |
| `locked` | number | Кол-во активов, занятых под активные заявки или ГО |
| `balancePrice` | number | Балансовая цена (цена открытия позиции) в валюте цены |
| `currentPrice` | number | Текущая цена |
| `balanceValue` | number | Балансовая стоимость в валюте цены |
| `balanceValueRub` | number | Балансовая стоимость в рублях |
| `balanceValueUsd` | number | Балансовая стоимость в долларах |
| `balanceValueEur` | number | Балансовая стоимость в евро |
| `currentValue` | number | Текущая стоимость в валюте цены |
| `currentUserValueRub` | number | Текущая стоимость в рублях |
| `currentUserValueUsd` | number | Текущая стоимость в долларах |
| `currentUserValueEur` | number | Текущая стоимость в евро |
| `unrealizedPL` | number | Нереализованный P/L (изменение цены с момента открытия позиции) |
| `unrealizedPercentPL` | number | Нереализованный P/L, % |
| `dailyPL` | number | Дневное изменение цены с момента открытия позиции |
| `dailyPercentPL` | number | Дневное изменение, % |
| `portfolioShare` | number | Доля в портфеле, % (от рублевой стоимости портфеля) |
| `scale` | number | Количество знаков (точность цены) |
| `minimumStep` | number | Минимальный шаг цены |
| `board` | string | Код класса ценной бумаги (борд, напр. `TQBR`; см. Boards API Мосбиржи) |
| `priceUnit` | number | Единица цены |
| `faceValue` | number | Номинал (для облигаций) |
| `accruedIncome` | number | НКД — накопленный купонный доход (для облигаций) |
| `isBlockedTradeAccount` | boolean | Заблокирован ли торговый счёт |
| `lockedForFutures` | number | Занято под ГО по фьючерсам |
| `isBlocked` | boolean | Деньги, занятые в активных заявках или под ГО |
| `ratioQuantity` | number | Количество в лоте |
| `logoLink` | string | Ссылка на логотип (может быть пустой строкой) |

*(примечание: в исходной таблице документации поля текущей стоимости называются
`currentUserValueRub` / `currentUserValueUsd` / `currentUserValueEur`; в TS-модели
безопасно объявлять их опциональными fallback'ами, если реальный ответ придёт с другими
именами — проверить на живом API.)*

### 3.3 Ошибки endpoint'а «Портфель»

| HTTP код | Текстовый код | Описание |
|---|---|---|
| 401 | `UNAUTHORIZED` | Пользователь не авторизован |
| 400 | `VALIDATION_ERROR` | Ошибка валидации |
| 404 | `NOT_FOUND` | Данные не найдены |
| 5xx | `INTERNAL_SERVER_ERROR` | Внутренняя серверная ошибка |

### 3.4 Целевой поток MVP-сервера

```
[Хранимый refresh_token]
        │  POST keycloak token (client_id=trade-api-read, grant_type=refresh_token)
        ▼
[access_token (24ч)] ──кэш, обновление по expires_in / при 401──┐
        │  GET /trade-api-bff-portfolio/api/v1/portfolio         │
        ▼                                                        │
[positions[]] → нормализация → отдаём в собственный веб-клиент ◄─┘
   (REST-поллинг; позже — WS wss://.../portfolio/ws)
```

Правила для сервера:
1. Refresh-токен хранить только на сервере (никогда не отдавать клиенту).
2. Кэшировать access-токен; при истечении (`expires_in`) или ответе 401 — переобмен и повтор запроса (1 retry).
3. После обмена сохранять присланный в ответе новый `refresh_token`.
4. Для MVP достаточно прав «только чтение» (`client_id=trade-api-read`).

---

## 4. Альтернатива: Портфель через сервис «Лимиты»

```
GET https://be.broker.ru/trade-api-bff-limit/api/v1/limits
Authorization: Bearer <access_token>

WS: wss://ws.broker.ru/trade-api-bff-limit/api/v1/limits/ws
```

Запрос: только заголовок `Authorization`. Доступен токеном «только чтение».

### 4.1 Структура ответа

Корень содержит 4 контейнера: `depoLimit`, `futureHolding`, `moneyLimit`, `futuresLimit`.

#### `depoLimit` — акции, облигации, валюты в портфеле

| Поле | Тип | Обязат. | Описание |
|---|---|---|---|
| `ticker` | string | нет | Тикер инструмента |
| `classCode` | string | нет | Код борда (напр. `TQBR`) |
| `exchange` | enum | да | Биржа: `MOEX` (Мосбиржа) |
| `averagePrice` | float | нет | Средневзвешенная цена открытия позиции |
| `quantity` | object | нет | Количество в **штуках**; содержит `type` и `value` |
| `quantity.type` | string | нет | Режим расчётов: `T0`, `T1`, `T2`, `T365` … |
| `quantity.value` | float | нет | Количество штук с учётом значения T |
| `quantityBatch` | object | нет | Количество в **лотах** (8 знаков после запятой); содержит `type` и `value` |
| `quantityBatch.type` | string | нет | `T0`, `T1`, `T2`, `T365` … |
| `quantityBatch.value` | float | нет | Количество лотов с учётом значения T |
| `instrumentType` | string | да | Тип инструмента (акция, облигация…) |
| `loadDate` | date-time | нет | Время обновления данных, ISO 8601 (`2024-10-30T09:01:00.000Z`) |
| `lockedBuyValue` | float | нет | Деньги в активных заявках на покупку данной бумаги |
| `lockedSellValue` | float | нет | Деньги в активных заявках на продажу данной бумаги |

#### `futureHolding` — позиции срочного рынка

| Поле | Тип | Обязат. | Описание |
|---|---|---|---|
| `ticker` | string | нет | Тикер инструмента |
| `classCode` | string | нет | Код борда |
| `exchange` | enum | да | `MOEX` |
| `cbplPlanned` | float | нет | Стоимостная оценка планируемых позиций после ближайшего клиринга |
| `varMargin` | float | нет | Оценка размера вариационной маржи по позициям |
| `positionValue` | float | нет | Стоимость позиций срочного рынка |
| `totalNet` | float | нет | Текущие чистые позиции |
| `executionDate` | date-time | нет | Дата исполнения, ISO 8601 |
| `totalVarMargin` | float | нет | Суммарная вар. маржа по итогам основного клиринга |
| `realVarMargin` | float | нет | Начисленная в ходе клиринга вар. маржа |
| `averagePrice` | float | нет | Средневзвешенная цена приобретения позиции |
| `instrumentType` | string | да | Тип инструмента |
| `tradeDate` | date-time | нет | Дата торговой сессии, ISO 8601 |

#### `moneyLimit` — деньги

| Поле | Тип | Обязат. | Описание |
|---|---|---|---|
| `exchange` | enum | да | Биржа |
| `currencyCode` | string(4) | нет | Код валюты |
| `locked` | float | нет | Деньги, занятые в активных заявках |
| `averagePrice` | float | нет | Средневзвешенная цена открытия позиции |
| `instrumentType` | string | да | Константа = `"money"` |
| `quantity` | object | нет | Содержит `type` (`T0`,`T1`,`T2`,`T365`) и `value` (float) |
| `loadDate` | date-time | нет | Дата загрузки, ISO 8601 |

#### `futuresLimit` — лимиты ФОРТС

| Поле | Тип | Обязат. | Описание |
|---|---|---|---|
| `currencyCode` | string(4) | нет | Код валюты |
| `exchange` | enum | да | Биржа |
| `accruedInt` | float | нет | Вариационная маржа на текущий день |
| `cbpl.init` | float | нет | Текущий лимит открытых позиций |
| `cbplUsed` | float | нет | Позиции после последнего клиринга |
| `cbp1Planned` | float | нет | Оценка планируемых позиций после ближайшего клиринга |
| `cbplusedForOrders` | float | нет | ГО, зарезервированное под клиентские заявки |
| `cbplusedForPositions` | float | нет | ГО, зарезервированное под открытые позиции |
| `optionsPremium` | float | нет | Премии по опционам |
| `instrumentType` | string | да | Константа = `"money"` |
| `loadDate` | date-time | нет | Дата загрузки, ISO 8601 |
| `varMargin` | float | нет | Оценка размера вар. маржи по позициям |
| `realVarMargin` | float | нет | Начисленная в ходе клиринга вар. маржа |

Ошибки: `401 UNAUTHORIZED`, `5xx INTERNAL_SERVER_ERROR`.

---

## 5. Справочно (вне MVP): торговые операции

### 5.1 Создание торговой заявки (только права «для торговли»)

```
POST https://be.broker.ru/trade-api-bff-operations/api/v1/orders
Authorization: Bearer <access_token>
```

Тело (JSON):

| Поле | Тип | Обязат. | Описание |
|---|---|---|---|
| `clientOrderId` | UUID | да | Генерируется клиентом; защита от дублей |
| `side` | enum | да | `1` — покупка, `2` — продажа |
| `orderType` | enum | да | `1` — рыночная, `2` — лимитная |
| `orderQuantity` | int > 0 | да | Количество активов, шт. |
| `ticker` | string | да | Тикер бумаги |
| `classCode` | string | да | Код борда (напр. `TQBR`) |
| `price` | float | только для лимитных | > 0, дробное, ≤ 8 знаков после запятой |

Успешный ответ: `{ "clientOrderId": UUID, "status": string }`.
Ошибки: 401 `UNAUTHORIZED`, 404 `NOT_FOUND`, 400 `VALIDATION_ERROR` / `BAD_REQUEST`, 5xx.

### 5.2 Изменение заявки

```
POST .../orders/{originalClientOrderId}
```

Тело: `clientOrderId` (новый UUID), `price` (float > 0, ≤ 8 знаков), `orderQuantity` (int > 0),
`classCode` (string). Технически = отмена старой + создание новой.
Ответ: `{ clientOrderId, status }`. Ошибки те же.

### 5.3 Отмена заявки

```
POST .../orders/{originalClientOrderId}/cancel
```

Тело: `clientOrderId` (новый UUID). Ответ: `{ clientOrderId, status }`.

### 5.4 Статус заявки

```
GET .../orders/{originalClientOrderId}
```

Ответ: `originalClientOrderId`, `clientOrderId`, `data` (контейнер, `null` при ошибке) c полями:

`orderStatus` (enum: 0 new, 1 partially filled, 2 filled, 4 canceled, 5 replaced,
6 pending cancel, 8 rejected, 9 pending replace, 10 pending new), `orderQuantity`,
`executedQuantity`, `lastQuantity`, `remainedQuantity`, `ticker`, `classCode`,
`side` (1/2), `orderType` (1/2), `averagePrice`, `orderId`, `executionId`, `price`
(стоп-заявки → 0; репо/спреды — цена первой части), `currency`, `clientCode`,
`transactionTime` (ISO 8601), `tradeDate`, `orderNumber`, `accruedCoupon`,
`executionValue`, `commission`, `securityExchange`,
`rejectReason` (0 too late to cancel, 1 unknown order, 2 broker option,
3 already in pending state).

### 5.5 Стриминг заявок (WS, write-токен)

- Обновления статусов созданных заявок: `wss://ws.broker.ru/trade-api-bff-operations/api/v1/orders/transaction/ws`
- Исполненные заявки: `wss://ws.broker.ru/trade-api-bff-operations/api/v1/orders/execution/ws`

Запрос: заголовок `Authorization`. Сообщение — тот же формат, что `data` статуса заявки
(`originalClientOrderId`, `clientOrderId`, `data{...}`).

⚠️ Особенность: если стриминг открыт **до** создания заявки — данные попадут в стрим;
если заявка создана до открытия стрима — статус узнаётся только REST-запросом.

---

## 6. Справочно (вне MVP): market data

Единый WS-эндпоинт подписок: `wss://ws.broker.ru/trade-api-market-data-connector/api/v1/market-data/ws`
(+ `Authorization: Bearer`). После подключения клиент отправляет JSON-сообщение подписки:

| Поле | Тип | Описание |
|---|---|---|
| `subscribeType` (`subscriberType` в разделах сделок/свечей) | enum | `0` — Subscribe, `1` — Unsubscribe |
| `dataType` | enum | `0` — стакан, `1` — последняя свеча, `2` — обезличенные сделки, `3` — котировки |
| `instruments` | array | список `{ ticker: string, classCode: string }` |
| `depth` | int | только стакан: 1–20, по умолчанию 20 |
| `timeFrame` | enum | только последняя свеча: M1…M60 |

**Стакан (ответ):** `responseType` (`OrderBook` / `OrderBookSuccess`), `subscribeType`,
`depth`, `dateTime`, `ticker`, `classCode`, `bidVolume`, `askVolume`,
`bids[]{price, quantity}` (по убыванию), `asks[]{price, quantity}` (по возрастанию),
`error{message, code}` (code: 0 Undefined, 1 NoData, 2 NotFound, 3 InvalidJson).

**Котировки (ответ):** `responseType="quotes"`, `ticker`, `classCode`, `dateTime`, `type`,
`securityTradingStatus` (2 Trading Hall, 17 Ready to trade, 18 Not available, 100 Closing,
101 Opening, 102 Auction, 103 Closing Auction), `currency`, `bid`, `offer`, `open`,
`close`, `high`, `low`, `theoreticalPrice`, `last`, `butYield`, `otherYield`, `change`,
`changeRate`.

**Обезличенные сделки (ответ):** `responseType` (`LastTrades` / `LastTradesSuccess`),
`subscriberType`, `ticker`, `classCode`, `dateTime`, `side`, `price`, `volume`,
`quantity`, `error{message, code(0..3)}`.

**Последняя свеча (ответ):** `requested` (UUID), `responded` (UUID),
`instrument{code, exchange}`, `subscribeResponse{subscribeType, timeFrame, dateTimeUtc}`,
`candleStick{dateTimeUtc, timeFrame, open, close, high, low, volume}`,
`error{message, code}` (13 INTERNAL / 16 UNAUTHENTICATED — коды gRPC-стиля).

**Исторические свечи (HTTP):**

```
GET https://be.broker.ru/trade-api-market-data-connector/api/v1/candles-chart
    ?classCode=TQBR&ticker=SBER&startDate=...&endDate=...&timeFrame=D
```

Query: `classCode`, `ticker`, `startDate`, `endDate` (ISO 8601),
`timeFrame` ∈ {M1,M5,M15,M30,H1,H4,D,W,MN}. Ответ: `classCode`, `ticker`, `startDate`,
`endDate`, `timeframe`, `bars[]{time, open, high, low, close, volume}`.
Ошибки: 401, 404, 400 (`BAD_REQUEST`/`VALIDATION_ERROR`), 5xx.

---

## 7. Справочно (вне MVP): information service

### 7.1 Поиск инструмента по тикерам

```
POST https://be.broker.ru/trade-api-information-service/api/v1/instruments/by-tickers
Body: { "tickers": ["SBER", ...] }
```

Ответ: `instruments[]` — расширенная карточка инструмента: `ticker`, `boards[]{classCode,
exchange}`, `shortName`, `isin`, `registrationCode`, `issuerName`, `instrumentType`,
`tradingCurrency`, `displayName`, `displayNameSecond`, `currencyStepPrice`, `settleCode`,
`faceValue`, `type`, `scale`, `minimumStep`, `stepPrice`, `accruedint`, `cfi`,
`isQualifiedOnly`, `isCanShort`, `availableForUnqualified`, `qualifiedTestId`,
`qualifiedTestIdTm`, `complexProduct`, `isBcsProduct`, `currencyNominal`,
`couponsPerYear`, `couponRate`, `nextCoupon`, `baseAsset`, `lotSize`, `maturityDate`,
`logoLink`, `baseAssetFuture`, `subType`, `percentTargetCurrent`, `businessSector`,
`mktcap`, `peNorm`, `priceTangible`, `epsGrowthRate`, `predictedDps`, `dividendYield`,
`priceChangeYear`, `targetPrice`, `businessSectorId`, `isBlocked`, `primaryBoard`,
`secondaryBoards[]`, `isCanMargin`, `emissionDate`, `isReplacementBond`, `subTitle`,
`couponTypeName`, `excludeTypeFlags`, `excludeTypes[]`, `creditRating`,
`liquidityRating`, `bcsScore`, `bcsScoreColor`, `nrdCode`, `businessCountry`,
`businessCountryCode`, `priceChangeHalfYear`, `priceChangeMonth`,
`priceChangeEarlyYear`, `strike`, `baseAssetSecuritySecCode`,
`baseAssetSecurityClassCode`, `firstCurrCode`, `amortisedMty`, `settlementCurrency`,
`settlementDate`, `promoIdx`.

### 7.2 Поиск инструмента по типу

```
GET https://be.broker.ru/trade-api-information-service/api/v1/instruments/by-type?type=STOCK&baseAssetTicker=...
```

Query: `type` (обязат.), `baseAssetTicker` (обязат. при `type=OPTIONS`).
Типы: `CURRENCY, STOCK, FOREIGN_STOCK, BONDS, NOTES, DEPOSITARY_RECEIPTS, EURO_BONDS,
MUTUAL_FUNDS, ETF, FUTURES, OPTIONS, GOODS, INDICES`. Ответ — тот же `instruments[]`.

### 7.3 Расписание инструмента

```
GET .../trade-api-information-service/api/v1/trading-schedule/daily-schedule?classCode=TQBR&ticker=SBER
```

(ticker регистрозависимый; если не найден — расписание по classCode).
Ответ: `isWorkingDay` (bool), `dailySchedule[]{startDate, endDate, tradingSessionType,
tradingSessionStatus: OPEN/CLOSE}`.

### 7.4 Торговый статус инструмента

```
GET .../trade-api-information-service/api/v1/trading-schedule/status?classCode=TQBR
```

Ответ: `tradingSessionType`, `tradingSessionStatus` (OPEN/CLOSE),
`tradingSessionTypeID` (number), `nextSessionDate` (`2021-01-19T09:41:03`).

---

## 8. Справочно (вне MVP): маржинальные показатели и дисконты

### 8.1 Маржинальные показатели (только WS)

```
wss://ws.broker.ru/trade-api-bff-marginal-indicators/api/v1/marginal-indicators/ws
Authorization: Bearer <access_token>
```

Сообщение-ответ (ключевые контейнеры):

- `agreementData{ number, isIia, displayName, subaccountId, color }` — данные счёта.
- `portfolioCurrentValue{ currentValueRub, dailyPortfolioChangeRub,
  dailyPortfolioChangePerc, totalPortfolioChangeRub, totalPortfolioChangePerc,
  collateralAvailable, varMargin }` — стоимость и финансовый результат.
- `portfolioStability{ isMarginOn, borrowedFunds, stabilityStatusId (0–5),
  stabilityStatusName (Принудительное закрытие(0)/Маржин-колл(1)/Низкая(2)/Средняя(3)/
  Высокая(4)/Максимальная(5)), refillSum }`.
- `fortsStability{ ownFunds, freeCash, stabilityStatusId, stabilityStatusName, refillSum,
  fortsMarginCall, fortsForcedClosure, riskLevel (0–4: не указан/КНУР/КСУР/КПУР/КОУР) }`.
- `marginParameters{ marginValue, collateral, marginCall, forcedClosure }` — приходит всегда.
- `cashByCurrency[]{ currency, sum }` — свободные деньги по валютам.
- `moneyDebt{ totalMoneyDebt, debtByCurrency[]{currency, sum} }`.
- `marginSecurities{ totalMarginSecurity, marginBySecurity[]{ticker, board, displayName,
  logoLink, quantity, currentValue, currency, discount} }` — шорты.
- `futuresParameters{ futuresValue, futuresPortfolio[]{ticker, board, currentValue,
  balanceValue, futuresCollateral, discount, displayName, logoLink} }`.

Ошибки: 401, 400 `BAD_REQUEST`, 404, 5xx.

### 8.2 Дисконты

```
GET https://be.broker.ru/trade-api-bff-marginal-indicators/api/v1/instruments-discounts
```

Ответ — массив `{ ticker: string, discountLong: double, discountShort: double }`.
Ошибки: 401, 5xx.

---

## 9. Прочие правила и замечания

- **Жизненный цикл токенов:** refresh 90 дней → перевыпустить в веб-версии заранее;
  access 24 часа → автоматический обмен на сервере.
- **Каждый обязательный параметр передаётся ровно один раз.**
- Формат дат в ответах — ISO 8601 (пример `2024-10-30T09:01:00.000Z`).
- Новые торговые сутки по фьючерсам — после вечернего клиринга в 19:05; с этого момента
  «Изменение цены за день» считается заново.
- `classCode`/`board` — коды площадок Мосбиржи (см. таблицы Boards в документации MOEX
  API); большинство акций — `TQBR`.
- Рекомендация по реализации MVP: сервер-агент (хранит refresh-токен, кэширует access),
  эндпоинт вида `GET /api/portfolio` → прокси `positions[]`, периодический поллинг
  (например, каждые N секунд в торговую сессию); WS-портфель — следующее улучшение.
