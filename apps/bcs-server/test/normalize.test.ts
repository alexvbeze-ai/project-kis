import { describe, it, expect } from "vitest";
import { normalizePortfolio } from "../src/services/normalize.js";
import type { BcsPosition } from "../src/types/bcs.js";

const base: BcsPosition = {
  type: "depoLimit",
  account: "A1-1234567890",
  exchange: "MOEX",
  ticker: "SBER",
  displayName: "Сбербанк",
  baseAssetTicker: "",
  currency: "RUB",
  upperType: "RUSSIA",
  instrumentType: "TCS",
  term: "T1",
  quantity: 10,
  locked: 0,
  balancePrice: 200,
  currentPrice: 250,
  balanceValue: 2000,
  balanceValueRub: 2000,
  balanceValueUsd: 0,
  balanceValueEur: 0,
  currentValue: 2500,
  currentValueRub: 2500,
  currentValueUsd: 0,
  currentValueEur: 0,
  unrealizedPL: 500,
  unrealizedPercentPL: 25,
  dailyPL: 10,
  dailyPercentPL: 0.4,
  portfolioShare: 60,
  scale: 2,
  minimumStep: 0.01,
  board: "TQBR",
  priceUnit: "RUB",
  faceValue: 0,
  accruedIncome: 0,
  isBlockedTradeAccount: false,
  lockedForFutures: 0,
  isBlocked: false,
  ratioQuantity: 1,
  logoLink: "",
};

describe("normalizePortfolio", () => {
  it("maps positions to UnifiedPortfolio", () => {
    const u = normalizePortfolio({ positions: [base] });
    expect(u.broker).toBe("bcs");
    expect(u.positions).toHaveLength(1);
    expect(u.positions[0].instrumentId).toBe("MOEX:SBER");
    expect(u.positions[0].marketValue).toBe(2500);
    expect(u.positions[0].marketValueRub).toBe(2500);
    expect(u.accounts.length).toBeGreaterThan(0);
    expect(u.accounts[0].id).toBe("••••7890");
  });

  it("separates moneyLimit rows into account cash", () => {
    const cash: BcsPosition = {
      ...base,
      type: "moneyLimit",
      upperType: "CURRENCY",
      ticker: "RUB",
      quantity: 5000,
      currentPrice: 1,
    };
    const u = normalizePortfolio({ positions: [base, cash] });
    expect(u.positions).toHaveLength(1);
    const acc = u.accounts.find((a) => a.currency === "RUB")!;
    expect(acc.cash).toBeGreaterThanOrEqual(5000);
  });

  it("groups accounts by account+currency without deprecated fields", () => {
    const p2: BcsPosition = { ...base, account: "A2-999", ticker: "VTBR" };
    const u = normalizePortfolio({ positions: [base, p2] });
    expect(u.accounts).toHaveLength(2);
    expect(u.positions).toHaveLength(2);
  });
});
