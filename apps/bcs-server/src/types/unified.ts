/**
 * Единый внутренний контракт брокерских адаптеров (contracts/broker-api/openapi.yaml).
 */

export interface BrokerMeta {
  code: string;
  name: string;
  features: string[];
}

export interface RefreshCheckResult {
  valid: boolean;
  /** Ротированный Keycloak новый refresh-токен — клиент перезапишет его в браузере */
  newRefreshToken: string | null;
  expiresIn: number;
}

export interface UnifiedAccount {
  id: string;
  type: "broker" | "iis" | "margin";
  currency: string;
  cash: number;
  lockedCash: number;
}

/** Класс актива для группировки в UI (BCS-SPEC §3.2, классификация — normalize.classifyAssetClass). */
export type AssetClass = "stock" | "bond" | "etf" | "currency" | "other";

export interface UnifiedPosition {
  instrumentId: string;
  ticker: string;
  displayName: string;
  assetClass: AssetClass;
  /** Сырое значение instrumentType из ответа БКС (справочно) */
  instrumentType: string | null;
  quantity: number;
  avgPrice: number | null;
  price: number;
  currency: string;
  marketValue: number;
  marketValueRub: number | null;
  /** Балансовая стоимость в рублях (для отображения «по цене покупки», BCS-SPEC §3.2) */
  balanceValueRub: number | null;
  unrealizedPL: number | null;
  unrealizedPercentPL: number | null;
  dailyPL: number | null;
  dailyPercentPL: number | null;
  portfolioShare: number | null;
  logoLink: string | null;
}

export interface UnifiedPortfolio {
  broker: string;
  asOf: string;
  accounts: UnifiedAccount[];
  positions: UnifiedPosition[];
}

export type UnifiedErrorCode =
  | "UPSTREAM_UNAUTHORIZED"
  | "UPSTREAM_RATE_LIMIT"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL";

export interface UnifiedError {
  code: UnifiedErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class UnifiedApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: UnifiedErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
