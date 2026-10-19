/**
 * Конфигурация bcs-server. Секреты брокера (client_id) — env; refresh-токены —
 * НЕ хранятся на сервере (модель MVP: токен живёт в браузере пользователя).
 */
export const config = {
  port: Number(process.env.PORT ?? 8081),
  host: process.env.HOST ?? "0.0.0.0",

  // BCS-SPEC §2.2 — Keycloak БКС
  keycloakTokenUrl:
    process.env.BCS_KEYCLOAK_URL ??
    "https://be.broker.ru/trade-api-keycloak/realms/tradeapi/protocol/openid-connect/token",
  clientIdRead: process.env.BCS_CLIENT_ID ?? "trade-api-read",

  // BCS-SPEC §3.1 — портфель
  bcsBaseUrl: process.env.BCS_BASE_URL ?? "https://be.broker.ru",
  portfolioPath: "/trade-api-bff-portfolio/api/v1/portfolio",

  // Кэш access-токенов: refresh-токен -> { accessToken, expiresAt }
  tokenCacheTtlSafetyMs: 60_000, // обмен на минуту раньше фактического истечения
  tokenCacheMaxEntries: 500,

  // CORS: кто может звать адаптер (в prod — только core-server из docker-сети)
  corsOrigin: (process.env.CORS_ORIGIN ?? "*").split(","),
};
