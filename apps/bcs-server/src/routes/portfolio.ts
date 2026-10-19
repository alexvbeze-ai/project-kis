/**
 * GET /v1/portfolio — контрактный endpoint портфеля (BCS-SPEC §3.1 + normalize).
 * POST /v1/auth/refresh-token — валидация refresh-токена с возвратом ротированного.
 */
import type { FastifyInstance } from "fastify";
import { fetchPortfolio } from "../services/bcs-client.js";
import { normalizePortfolio } from "../services/normalize.js";
import { getAccessToken } from "../services/keycloak.js";
import { readRefreshTokenHeader } from "../plugins/errors.js";
import { UnifiedApiError, type RefreshCheckResult } from "../types/unified.js";

export async function portfolioRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/portfolio", async (req, reply) => {
    const refreshToken = readRefreshTokenHeader(req);
    if (!refreshToken) {
      throw new UnifiedApiError(401, "UPSTREAM_UNAUTHORIZED", "Отсутствует заголовок X-Broker-Refresh-Token");
    }
    const { data, access } = await fetchPortfolio(refreshToken);
    const portfolio = normalizePortfolio(data);

    // Ротация Keycloak: отдаём новый refresh клиенту для перезаписи в браузере
    void access; // используется ниже через заголовок-предупреждение + поле meta
    reply.header("x-bcs-refresh-rotated", access.newRefreshToken ? "1" : "0");
    return { ...portfolio, rotatedRefreshToken: access.newRefreshToken };
  });

  app.post("/v1/auth/refresh-token", async (req): Promise<RefreshCheckResult> => {
    const refreshToken = readRefreshTokenHeader(req);
    if (!refreshToken) {
      throw new UnifiedApiError(401, "UPSTREAM_UNAUTHORIZED", "Отсутствует заголовок X-Broker-Refresh-Token");
    }
    const access = await getAccessToken(refreshToken);
    return {
      valid: true,
      newRefreshToken: access.newRefreshToken,
      expiresIn: access.expiresIn,
    };
  });
}
