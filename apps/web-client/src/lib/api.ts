import type { UnifiedPortfolio, UnifiedError } from "../types";
import { ApiError } from "../types";

/**
 * Клиент обращается ТОЛЬКО к core-server (ядро, Java Spring).
 * Путь /api — относительный: в dev его проксирует vite, в прод — nginx.
 * Ядро само маршрутизирует запрос нужному брокерскому адаптеру.
 */
const CORE_BASE = import.meta.env?.VITE_CORE_API ?? "/api/v1";

async function parseError(res: Response): Promise<ApiError> {
  let unified: UnifiedError;
  try {
    unified = (await res.json()) as UnifiedError;
  } catch {
    unified = { code: "INTERNAL", message: `HTTP ${res.status}` };
  }
  return new ApiError(res.status, unified);
}

export interface PortfolioResult {
  portfolio: UnifiedPortfolio;
  /** Если Keycloak ротировал refresh-токен — ядро вернёт новый в заголовке. */
  rotatedRefreshToken: string | null;
}

export async function fetchPortfolio(params: {
  broker: string;
  refreshToken: string;
  signal?: AbortSignal;
}): Promise<PortfolioResult> {
  const res = await fetch(`${CORE_BASE}/portfolio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ broker: params.broker, refreshToken: params.refreshToken }),
    signal: params.signal,
  });
  if (!res.ok) throw await parseError(res);
  const portfolio = (await res.json()) as UnifiedPortfolio;
  const rotated = res.headers.get("X-Rotated-Refresh-Token");
  return { portfolio, rotatedRefreshToken: rotated && rotated.trim() ? rotated : null };
}
