/**
 * Типы внешнего API БКС (be.broker.ru) — по BCS-SPEC.md.
 */

// ---------- Keycloak (BCS-SPEC §2.2) ----------
export interface KeycloakTokenResponse {
  access_token: string;
  /** Keycloak отдаёт числа, хотя в документации строки */
  expires_in: number | string;
  refresh_expires_in: number | string;
  refresh_token: string;
  token_type: string;
  session_state?: string;
  scope?: string;
}

// ---------- GET /trade-api-bff-portfolio/api/v1/portfolio ----------
export interface BcsPosition {
  type: string;
  subAccountId: string;
  agreementId: string;
  account: string;
  exchange: string;
  ticker: string;
  displayName: string;
  baseAssetTicker: string;
  currency: string;
  expireDate: string | null;
  upperType: string;
  instrumentType: string;
  term: string;
  quantity: number;
  locked: number;
  balancePrice: number;
  currentPrice: number;
  balanceValue: number;
  balanceValueRub: number;
  balanceValueUsd: number;
  balanceValueEur: number;
  currentValue: number;
  currentUserValueRub: number;
  currentUserValueUsd: number;
  currentUserValueEur: number;
  unrealizedPL: number;
  unrealizedPercentPL: number;
  dailyPL: number;
  dailyPercentPL: number;
  portfolioShare: number;
  scale: number;
  minimumStep: number;
  board: string;
  priceUnit: number;
  faceValue: number;
  accruedIncome: number;
  isBlockedTradeAccount: boolean;
  lockedForFutures: number;
  isBlocked: boolean;
  ratioQuantity: number;
  logoLink: string;
}

export interface BcsPortfolioResponse {
  positions: BcsPosition[];
}
