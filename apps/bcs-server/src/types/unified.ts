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

export interface UnifiedPosition {
  instrumentId: string;
  ticker: string;
  displayName: string;
  quantity: number;
  avgPrice: number | null;
  price: number;
  currency: string;
  marketValue: number;
  marketValueRub: number | null;
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
