/**
 * HTTP-клиент BCS API портфеля (BCS-SPEC §3.1) с retry на 401:
 * 401 -> инвалидация кэша access -> повторный обмен refresh -> один повтор запроса.
 */
import { request } from "undici";
import { config } from "../config.js";
import type { BcsPortfolioResponse } from "../types/bcs.js";
import { UnifiedApiError } from "../types/unified.js";
import { getAccessToken, invalidateAccessToken, type AccessResult } from "./keycloak.js";
import { mockBcsPortfolio } from "./mock-data.js";

export interface PortfolioFetchResult {
  data: BcsPortfolioResponse;
  access: AccessResult;
}

/** DEMO-режим: KIS_MOCK_BCS=1 — любой непустой токен валиден, портфель фиктивный. */
const MOCK_ACCESS: AccessResult = { accessToken: "mock", newRefreshToken: null, expiresIn: 300 };

async function fetchPortfolioWithToken(accessToken: string): Promise<BcsPortfolioResponse> {
  let res;
  try {
    res = await request(config.bcsBaseUrl + config.portfolioPath, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      headersTimeout: 15_000,
      bodyTimeout: 15_000,
    });
  } catch (err) {
    throw new UnifiedApiError(502, "UPSTREAM_UNAVAILABLE", "BCS API недоступен", {
      cause: String(err),
    });
  }

  if (res.statusCode === 401) {
    await res.body.text();
    const e = new UnifiedApiError(401, "UPSTREAM_UNAUTHORIZED", "access-токен отклонён BCS API");
    e.name = "UnauthorizedUpstream";
    throw e;
  }
  if (res.statusCode === 429) {
    await res.body.text();
    throw new UnifiedApiError(429, "UPSTREAM_RATE_LIMIT", "BCS API: слишком много запросов");
  }
  if (res.statusCode >= 500) {
    await res.body.text();
    throw new UnifiedApiError(502, "UPSTREAM_UNAVAILABLE", `BCS API вернул ${res.statusCode}`);
  }
  if (res.statusCode !== 200) {
    const text = await res.body.text();
    throw new UnifiedApiError(502, "UPSTREAM_UNAVAILABLE", `BCS API вернул ${res.statusCode}`, {
      body: text.slice(0, 500),
    });
  }

  const json = (await res.body.json()) as BcsPortfolioResponse;
  if (!Array.isArray(json.positions)) {
    throw new UnifiedApiError(502, "UPSTREAM_UNAVAILABLE", "Неожиданная структура ответа BCS API");
  }
  return json;
}

export async function fetchPortfolio(refreshToken: string): Promise<PortfolioFetchResult> {
  if (config.mockBcs) {
    return { data: mockBcsPortfolio(), access: MOCK_ACCESS };
  }
  let access = await getAccessToken(refreshToken);
  try {
    const data = await fetchPortfolioWithToken(access.accessToken);
    return { data, access };
  } catch (err) {
    if (err instanceof UnifiedApiError && err.code === "UPSTREAM_UNAUTHORIZED") {
      // один retry со свежим access-токеном (BCS-SPEC §3.4 правило 2)
      invalidateAccessToken(refreshToken);
      access = await getAccessToken(refreshToken);
      const data = await fetchPortfolioWithToken(access.accessToken);
      return { data, access };
    }
    throw err;
  }
}
