/**
 * Регрессия на актуальный контракт BCS API (BCS-SPEC §3.2, llms-full.txt 19.10.2026):
 * ответ портфеля — голый JSON-массив Portfolio[]. Старый формат { positions: [] }
 * БОЛЬШЕ НЕ поддерживается (fallback удалён по решению от 19.10.2026).
 */
import { describe, it, expect } from "vitest";
import { parseBcsPortfolio } from "../src/types/bcs.js";
import { normalizePortfolio } from "../src/services/normalize.js";

const NEW_SHAPE = [
  {
    type: "moneyLimit",
    account: "12345",
    exchange: "MOEX",
    ticker: "",
    displayName: "Денежные средства",
    baseAssetTicker: "",
    currency: "RUB",
    upperType: "CURRENCY",
    instrumentType: "",
    term: "T0",
    quantity: 184320.55,
    locked: 0,
    balancePrice: 0,
    currentPrice: 0,
    balanceValue: 0,
    balanceValueRub: 184320.55,
    currentValue: 184320.55,
    currentValueRub: 184320.55,
  },
  {
    type: "depoLimit",
    account: "12345",
    exchange: "MOEX",
    ticker: "LKOH",
    displayName: "ЛУКОЙЛ",
    currency: "RUB",
    upperType: "RUSSIA",
    instrumentType: "TCS",
    quantity: 14,
    locked: 0,
    balancePrice: 6890.0,
    currentPrice: 7240.5,
    currentValue: 101367.0,
    currentValueRub: 101367.0,
    unrealizedPL: 4907.0,
    portfolioShare: 35.4,
  },
];

describe("parseBcsPortfolio (только новый контракт)", () => {
  it("принимает голый массив", () => {
    const r = parseBcsPortfolio(NEW_SHAPE);
    expect(r.positions).toHaveLength(2);
  });

  it("отвергает старый формат-обёртку {positions:[]}", () => {
    expect(() => parseBcsPortfolio({ positions: NEW_SHAPE })).toThrow(/ожидался JSON-массив/);
  });

  it("отвергает мусор", () => {
    expect(() => parseBcsPortfolio({ foo: 1 })).toThrow(/Неожиданная структура/);
    expect(() => parseBcsPortfolio(null)).toThrow(/Неожиданная структура/);
  });
});

describe("normalizePortfolio (актуальный swagger-формат)", () => {
  it("moneyLimit уходит в cash, бумаги — в positions; currentValueRub читается", () => {
    const u = normalizePortfolio(parseBcsPortfolio(NEW_SHAPE));
    expect(u.accounts[0].cash).toBeCloseTo(184320.55, 2);
    expect(u.positions).toHaveLength(1);
    expect(u.positions[0].instrumentId).toBe("MOEX:LKOH");
    expect(u.positions[0].marketValueRub).toBe(101367.0);
  });
});
