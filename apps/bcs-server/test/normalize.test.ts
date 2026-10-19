import { describe, it, expect } from "vitest";
import { normalizePortfolio } from "../src/services/normalize.js";
import type { BcsPosition } from "../src/types/bcs.js";

const base: BcsPosition = {
  type: "stock", subAccountId: "sub1", agreementId: "1234567890", account: "A1",
  exchange: "MOEX", ticker: "SBER", displayName: "Сбербанк", baseAssetTicker: "",
  currency: "RUB", expireDate: null, upperType: "instrument", instrumentType: "stock",
  term: "T1", quantity: 10, locked: 0, balancePrice: 200, currentPrice: 250,
  balanceValue: 2000, balanceValueRub: 2000, balanceValueUsd: 0, balanceValueEur: 0,
  currentValue: 2500, currentUserValueRub: 2500, currentUserValueUsd: 0, currentUserValueEur: 0,
  unrealizedPL: 500, unrealizedPercentPL: 25, dailyPL: 10, dailyPercentPL: 0.4,
  portfolioShare: 60, scale: 2, minimumStep: 0.01, board: "TQBR", priceUnit: 1,
  faceValue: 0, accruedIncome: 0, isBlockedTradeAccount: false, lockedForFutures: 0,
  isBlocked: false, ratioQuantity: 1, logoLink: "",
};

describe("normalizePortfolio", () => {
  it("maps positions to UnifiedPortfolio", () => {
    const u = normalizePortfolio({ positions: [base] });
    expect(u.broker).toBe("bcs");
    expect(u.positions).toHaveLength(1);
    expect(u.positions[0].instrumentId).toBe("MOEX:SBER");
    expect(u.positions[0].marketValue).toBe(2500);
    expect(u.accounts.size ?? u.accounts.length).toBeGreaterThan(0);
    expect(u.accounts[0].id).toBe("••••7890");
  });

  it("separates cash rows (upperType=money)", () => {
    const cash = { ...base, ticker: "RUB_T", upperType: "money", quantity: 5000, currentPrice: 1, instrumentType: "currency" };
    const u = normalizePortfolio({ positions: [base, cash] });
    expect(u.positions).toHaveLength(1);
    const acc = u.accounts.find(a => a.currency === "RUB")!;
    expect(acc.cash).toBeGreaterThanOrEqual(5000);
  });
});
