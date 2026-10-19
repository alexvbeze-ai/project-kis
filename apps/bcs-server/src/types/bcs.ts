/**
 * Типы внешнего API БКС (be.broker.ru) — строго по актуальному контракту
 * BCS-SPEC.md (источник: trade-api.bcs.ru/llms-full.txt, снимок 19.10.2026).
 * Поддержка старого PDF-контракта удалена (§10): ответ портфеля — голый массив,
 * поля currentValueRub/Usd/Eur, без fallback-обёрток.
 */

// ---------- Keycloak (BCS-SPEC §2.3) ----------
export interface KeycloakTokenResponse {
  access_token: string;
  /** swagger: number; фактический Keycloak может отдавать строку — парсим оба */
  expires_in: number | string;
  refresh_expires_in: number | string;
  refresh_token: string;
  token_type: string;
  "not-before-policy"?: string;
  session_state?: string;
  scope?: string;
}

// ---------- GET /trade-api-bff-portfolio/api/v1/portfolio (BCS-SPEC §3.2) ----------
export type BcsPortfolioType = "moneyLimit" | "depoLimit" | "futuresLimit" | "futuresHolding" | "otcLimit";
export type BcsUpperType = "CURRENCY" | "RUSSIA" | "FOREIGN" | "OTC";
export type BcsTerm = "T0" | "T1" | "T2" | "T365";

/** Схема `Portfolio` из актуального swagger. */
export interface BcsPosition {
  type?: BcsPortfolioType;
  /** deprecated у БКС — не использовать в бизнес-логике */
  subAccountId?: string;
  /** deprecated у БКС — не использовать в бизнес-логике */
  agreementId?: string;
  account?: string;
  exchange?: string;
  ticker?: string;
  displayName?: string;
  baseAssetTicker?: string;
  currency?: string;
  upperType?: BcsUpperType;
  instrumentType?: string;
  term?: BcsTerm;
  quantity?: number;
  locked?: number;
  balancePrice?: number;
  currentPrice?: number;
  balanceValue?: number;
  balanceValueRub?: number;
  balanceValueUsd?: number;
  balanceValueEur?: number;
  currentValue?: number;
  currentValueRub?: number;
  currentValueUsd?: number;
  currentValueEur?: number;
  unrealizedPL?: number;
  unrealizedPercentPL?: number;
  dailyPL?: number;
  dailyPercentPL?: number;
  portfolioShare?: number;
  scale?: number;
  minimumStep?: number;
  board?: string;
  priceUnit?: string;
  faceValue?: number;
  accruedIncome?: number;
  logoLink?: string;
  isBlocked?: boolean;
  isBlockedTradeAccount?: boolean;
  lockedForFutures?: number;
  ratioQuantity?: number;
  expireDate?: string;
}

/** Корень ответа портфеля по актуальному контракту — голый JSON-массив. */
export type BcsPortfolioRaw = BcsPosition[];

/**
 * Валидация ответа портфеля строго по новому контракту (BCS-SPEC §3.2):
 * допускается только голый массив объектов Portfolio[]. Fallback'ов на старый
 * формат `{ positions: [] }` нет — поддержка удалена по решению от 19.10.2026.
 */
export function parseBcsPortfolio(json: unknown): BcsPortfolioRaw {
  if (!Array.isArray(json)) {
    throw new Error("Неожиданная структура ответа BCS API: ожидался JSON-массив Portfolio[]");
  }
  return json as BcsPosition[];
}
