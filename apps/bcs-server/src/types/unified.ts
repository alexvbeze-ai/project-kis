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
  /** Краткое наименование для компактных таблиц (облигации — без длинного выпуска). */
  shortName: string;
}

/**
 * Короткое имя инструмента для UI. Для облигаций длинные названия вида
 * «ОАО ... Корпоративные облигации ... серии 001Р-05» сокращаются до
 * эмитента + серий/даты погашения, чтобы таблицы акций и облигаций были
 * одинаковой ширины.
 */
export function makeShortName(ticker: string, displayName: string | undefined, assetClass: AssetClass): string {
  const full = (displayName || ticker).trim();
  if (assetClass !== "bond") return full;
  let s = full
    .replace(/^(ПАО|АО|ОАО|ЗАО)\s+/i, "")
    .replace(/\s+(корпоративные\s+)?(облигации|бонды|офз|федеральные\s+займы|еврооблигации)\b.*$/i, "");
  const series = full.match(/(?:серии?\s*)([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*)/iu)?.[1];
  if (series) s += ` ${series}`;
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 32 ? s.slice(0, 32).trimEnd() + "…" : s || ticker;
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
