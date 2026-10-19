/**
 * Типы единого контракта KIS (см. contracts/core-api + contracts/broker-api).
 * Клиент знает только ядро (core-server) — про брокеров он ничего не знает,
 * broker — просто строковый идентификатор подключения.
 */

export interface Account {
  id: string;            // маскированный номер счёта
  type: "broker" | "iis" | "margin";
  currency: string;
  cash: number;
  lockedCash: number;
}

/** Класс актива для группировки таблиц в UI (BCS-SPEC §3.2). */
export type AssetClass = "stock" | "bond" | "etf" | "currency" | "other";

export interface Position {
  instrumentId: string;  // канонический id, напр. "MOEX:SBER"
  ticker: string;
  displayName: string;
  /** Класс актива для группировки в UI (акции/облигации/фонды…, BCS-SPEC §3.2) */
  assetClass: AssetClass;
  /** Сырое значение instrumentType от брокера (справочно) */
  instrumentType: string | null;
  quantity: number;
  avgPrice: number | null;
  price: number;
  currency: string;
  marketValue: number;
  marketValueRub: number | null;
  /** Балансовая стоимость в рублях (по цене покупки) */
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
  asOf: string;          // ISO date-time
  accounts: Account[];
  positions: Position[];
}

export interface UnifiedError {
  code: "UPSTREAM_UNAUTHORIZED" | "UPSTREAM_RATE_LIMIT" | "UPSTREAM_UNAVAILABLE" | "INTERNAL";
  message: string;
  details?: Record<string, unknown> | null;
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly unified: UnifiedError) {
    super(unified.message);
    this.name = "ApiError";
  }
  get isUnauthorized() {
    return this.status === 401 || this.unified.code === "UPSTREAM_UNAUTHORIZED";
  }
}
