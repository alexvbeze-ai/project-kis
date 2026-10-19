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
/**
 * ВАЖНО (актуальный swagger с trade-api.bcs.ru/http/authorization):
 * БКС изменил контракт — ответ теперь **голый JSON-массив** позиций (без обёртки
 * `{ positions: [...] }`, как в старом PDF/BCS-SPEC §3.2). Плюс переименованы поля:
 *   currentUserValueRub → currentValueRub, currentUserValueUsd → currentValueUsd,
 *   currentUserValueEur → currentValueEur. Поля subAccountId/agreementId deprecated.
 * Поэтому все поля объявлены опциональными — адаптер не должен падать на расхождениях.
 */
export interface BcsPosition {
  type?: string; // moneyLimit | depoLimit | futuresLimit | futuresHolding | otcLimit
  subAccountId?: string; // deprecated
  agreementId?: string; // deprecated
  account?: string;
  exchange?: string;
  ticker?: string;
  displayName?: string;
  baseAssetTicker?: string;
  currency?: string;
  expireDate?: string | null;
  upperType?: string; // CURRENCY | RUSSIA | FOREIGN | OTC
  instrumentType?: string;
  term?: string; // T0 | T1 | T2 | T365
  quantity?: number;
  locked?: number;
  balancePrice?: number;
  currentPrice?: number;
  balanceValue?: number;
  balanceValueRub?: number;
  balanceValueUsd?: number;
  balanceValueEur?: number;
  currentValue?: number;
  currentValueRub?: number; // новый контракт
  currentValueUsd?: number;
  currentValueEur?: number;
  currentUserValueRub?: number; // старый контракт (PDF) — поддержка обоих форматов
  currentUserValueUsd?: number;
  currentUserValueEur?: number;
  unrealizedPL?: number;
  unrealizedPercentPL?: number;
  dailyPL?: number;
  dailyPercentPL?: number;
  portfolioShare?: number;
  scale?: number;
  minimumStep?: number;
  board?: string;
  priceUnit?: string | number;
  faceValue?: number;
  accruedIncome?: number;
  isBlockedTradeAccount?: boolean;
  lockedForFutures?: number;
  isBlocked?: boolean;
  ratioQuantity?: number;
  logoLink?: string;
}

/**
 * Ответ портфеля: новый контракт = массив позиций; старый (PDF) = { positions: [] }.
 * Нормализуется через normalizeBcsPortfolioResponse().
 */
export type BcsPortfolioRaw = BcsPosition[] | { positions?: BcsPosition[] };

export interface BcsPortfolioResponse {
  positions: BcsPosition[];
}

/** Приведение любого из двух известных форматов ответа к { positions: [] }. */
export function normalizeBcsPortfolioResponse(json: unknown): BcsPortfolioResponse {
  if (Array.isArray(json)) return { positions: json as BcsPosition[] };
  if (json && typeof json === "object" && Array.isArray((json as BcsPortfolioResponse).positions)) {
    return json as BcsPortfolioResponse;
  }
  throw new Error("Неожиданная структура ответа BCS API");
}
