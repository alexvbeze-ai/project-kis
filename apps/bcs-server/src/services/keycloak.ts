/**
 * Обмен refresh-токена на access-токен через Keycloak БКС (BCS-SPEC §2.2) +
 * in-memory кэш и single-flight.
 *
 * Модель MVP: refresh-токен приходит в каждом запросе от клиента
 * (заголовок X-Broker-Refresh-Token), сервер его НЕ хранит. Кэшируем только
 * короткие access-токены по ключу = sha256(refresh-токен).
 *
 * Важно про ротацию: Keycloak отдаёт НОВЫЙ refresh_token при каждом обмене.
 * Мы возвращаем его наверх (в ответ клиенту через core-server), чтобы браузер
 * перезаписал свой токен. Пока клиент не перезаписал — старый refresh всё ещё
 * может работать (Keycloak grace window), поэтому повторный обмен старого токена
 * допустим, но помечаем запись как "ротирована" и при следующем обмене
 * используем уже новый.
 */
import { createHash } from "node:crypto";
import { request } from "undici";
import { config } from "../config.js";
import type { KeycloakTokenResponse } from "../types/bcs.js";
import { UnifiedApiError } from "../types/unified.js";

interface CachedAccess {
  accessToken: string;
  /** unix ms, когда нужно переобновить */
  expiresAt: number;
  /** новый refresh после ротации (отдаём клиенту, но и держим для внутреннего обмена) */
  rotatedRefresh: string | null;
}

const cache = new Map<string, CachedAccess>(); // key = hash(refresh)
const inflight = new Map<string, Promise<{ access: CachedAccess; rotatedFromOld: boolean }>>();

function tokenKey(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function evictIfNeeded(): void {
  if (cache.size <= config.tokenCacheMaxEntries) return;
  const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
  if (oldest) cache.delete(oldest[0]);
}

async function exchangeRefreshForAccess(
  refreshToken: string,
): Promise<{ access: CachedAccess; raw: KeycloakTokenResponse }> {
  const body = new URLSearchParams({
    client_id: config.clientIdRead,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  let res;
  try {
    res = await request(config.keycloakTokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      headersTimeout: 10_000,
      bodyTimeout: 10_000,
    });
  } catch (err) {
    throw new UnifiedApiError(502, "UPSTREAM_UNAVAILABLE", "Keycloak БКС недоступен", {
      cause: String(err),
    });
  }

  const text = await res.body.text();
  let json: Partial<KeycloakTokenResponse> & { error?: string; error_description?: string };
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }

  if (res.statusCode === 401 || res.statusCode === 400 || json.error) {
    // invalid_grant / inactive refresh token / bad client
    throw new UnifiedApiError(401, "UPSTREAM_UNAUTHORIZED", "Refresh-токен недействителен или истёк", {
      keycloakError: json.error ?? `http_${res.statusCode}`,
      description: json.error_description,
    });
  }
  if (res.statusCode >= 500) {
    throw new UnifiedApiError(502, "UPSTREAM_UNAVAILABLE", "Ошибка Keycloak БКС", {
      status: res.statusCode,
    });
  }
  if (!json.access_token) {
    throw new UnifiedApiError(502, "UPSTREAM_UNAVAILABLE", "Неожиданный ответ Keycloak");
  }

  const expiresInSec = Number(json.expires_in ?? 86_400);
  const access: CachedAccess = {
    accessToken: json.access_token,
    expiresAt: Date.now() + expiresInSec * 1000 - config.tokenCacheTtlSafetyMs,
    rotatedRefresh: json.refresh_token && json.refresh_token !== refreshToken ? json.refresh_token : null,
  };
  return { access, raw: json as KeycloakTokenResponse };
}

export interface AccessResult {
  accessToken: string;
  /** Если Keycloak ротировал токен — новый refresh для перезаписи клиентом */
  newRefreshToken: string | null;
  expiresIn: number;
}

/**
 * Получить валидный access-токен для данного refresh-токена.
 * Single-flight: параллельные запросы с одним токеном делают один обмен.
 */
export async function getAccessToken(refreshToken: string): Promise<AccessResult> {
  const key = tokenKey(refreshToken);

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      accessToken: cached.accessToken,
      newRefreshToken: cached.rotatedRefresh,
      expiresIn: Math.max(0, Math.round((cached.expiresAt - Date.now()) / 1000)),
    };
  }

  const existing = inflight.get(key);
  if (existing) {
    const { access } = await existing;
    return {
      accessToken: access.accessToken,
      newRefreshToken: access.rotatedRefresh,
      expiresIn: Math.max(0, Math.round((access.expiresAt - Date.now()) / 1000)),
    };
  }

  const promise = exchangeRefreshForAccess(refreshToken).then(({ access }) => {
    cache.set(key, access);
    evictIfNeeded();
    return { access, rotatedFromOld: access.rotatedRefresh !== null };
  });
  inflight.set(key, promise);
  try {
    const { access } = await promise;
    return {
      accessToken: access.accessToken,
      newRefreshToken: access.rotatedRefresh,
      expiresIn: Math.max(0, Math.round((access.expiresAt - Date.now()) / 1000)),
    };
  } finally {
    inflight.delete(key);
  }
}

/** Принудительно выбросить кэш (при 401 от API портфеля). */
export function invalidateAccessToken(refreshToken: string): void {
  cache.delete(tokenKey(refreshToken));
}

/** Для тестов. */
export function _clearCache(): void {
  cache.clear();
  inflight.clear();
}
