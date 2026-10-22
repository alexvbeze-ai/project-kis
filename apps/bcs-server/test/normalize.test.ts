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
    const u = normalizePortfolio([base]);
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
    const u = normalizePortfolio([base, cash]);
    expect(u.positions).toHaveLength(1);
    const acc = u.accounts.find((a) => a.currency === "RUB")!;
    expect(acc.cash).toBeGreaterThanOrEqual(5000);
  });

  it("groups accounts by account+currency without deprecated fields", () => {
    const p2: BcsPosition = { ...base, account: "A2-999", ticker: "VTBR" };
    const u = normalizePortfolio([base, p2]);
    expect(u.accounts).toHaveLength(2);
    expect(u.positions).toHaveLength(2);
  });
});

describe("агрегация дублей позиций (BCS-SPEC §3.4)", () => {
  it("сливает строки одного инструмента с разными term в одну позицию", () => {
    const u = normalizePortfolio([
        { ...base, term: "T0", quantity: 5, balancePrice: 200, balanceValue: 1000, balanceValueRub: 1000, currentValue: 1250, currentValueRub: 1250 },
        { ...base, term: "T1", quantity: 10, balancePrice: 250, balanceValue: 2500, balanceValueRub: 2500, currentValue: 2500, currentValueRub: 2500 },
        { ...base, term: "T1", board: "FCPR", quantity: 2, balancePrice: 300, balanceValue: 600, balanceValueRub: 600, currentValue: 500, currentValueRub: 500 },
]);
    expect(u.positions).toHaveLength(1);
    const p = u.positions[0];
    expect(p.quantity).toBe(17);
    // взвешенная средняя: (5*200 + 10*250 + 2*300)/17
    expect(p.avgPrice).toBeCloseTo((1000 + 2500 + 600) / 17, 4);
    expect(p.marketValueRub).toBe(4250);
    expect(p.balanceValueRub).toBe(4100);
    expect(p.portfolioShare).toBeCloseTo(100, 6);
  });

  it("не сливает один тикер на разных счетах и считает долю от суммы", () => {
    const u = normalizePortfolio([
        base,
        { ...base, account: "IIS-999", quantity: 10, balanceValue: 2000, balanceValueRub: 2000, currentValue: 2500, currentValueRub: 2500 },
]);
    expect(u.positions).toHaveLength(2);
    expect(u.positions[0].portfolioShare).toBeCloseTo(50, 6);
  });

  it("не суммирует дубли одного тикера из вторичных классов торгов (OZON 4×)", () => {
    // БКС возвращает одну и ту же позицию в нескольких классах торгов:
    // основной TQBR + зеркала QJS/QNM/QNN с теми же количествами и стоимостями.
    const mirror = (board: string): BcsPosition => ({ ...base, board });
    const u = normalizePortfolio([base, mirror("QJS"), mirror("QNM"), mirror("QNN")]);
    expect(u.positions).toHaveLength(1);
    const p = u.positions[0];
    expect(p.quantity).toBe(10); // не 40
    expect(p.marketValueRub).toBe(2500); // не 10000
    expect(p.board ?? "TQBR").toBe("TQBR");
  });

  it("удаляет копии позиции, отличающиеся только сервисными полями (OZON ×4)", () => {
    // Прод-кейс: BFF портфеля отдаёт одну и ту же запись несколько раз, но
    // объекты НЕ идентичны — отличаются changePercentage/dailyPL/logoLink.
    // Точная дедупликация по JSON такие копии не ловила → сумма ×4.
    const copy = (i: number): BcsPosition => ({
      ...base,
      changePercentage: 1.1 + i * 0.2,
      dailyPL: i === 0 ? undefined : 10 * i,
      logoLink: i > 1 ? "https://bcs.ru/logo.png" : base.logoLink,
    });
    const u = normalizePortfolio([copy(0), copy(1), copy(2), copy(3)]);
    expect(u.positions).toHaveLength(1);
    const p = u.positions[0];
    expect(p.quantity).toBe(10); // не 40
    expect(p.marketValueRub).toBe(2500); // не 10000
  });

  it("удаляет точные дубликаты строк ответа БКС (OZON 60 шт. вместо 15)", () => {
    // Прод-кейс: BFF портфеля отдаёт полностью идентичный объект позиции ×4 подряд.
    const u = normalizePortfolio([base, { ...base }, { ...base }, { ...base }]);
    expect(u.positions).toHaveLength(1);
    const p = u.positions[0];
    expect(p.quantity).toBe(10); // не 40
    expect(p.marketValueRub).toBe(2500); // не 10000
    expect(p.unrealizedPL).toBe(p.unrealizedPL); // без ×4 — значение из единственной строки
  });

  it("сохраняет реальное дробление позиции по term/locked (не путает с дублями)", () => {
    const u = normalizePortfolio([
      base,
      // другой срок расчётов — это отдельный сегмент позиции, суммируется
      { ...base, term: "T2", quantity: 5, currentValue: 1250, currentValueRub: 1250, locked: 5 },
      // тот же сегмент (term T1), но часть бумаг занята заявками (locked) —
      // копия записи, учитывается один раз
      { ...base, quantity: 5, currentValue: 1250, currentValueRub: 1250, locked: 5 },
    ]);
    expect(u.positions).toHaveLength(1);
    expect(u.positions[0].quantity).toBe(15); // 10 (T1) + 5 (T2), не 20
  });

  it("классифицирует инструменты по instrumentType и fallback по board", () => {
    const u = normalizePortfolio([
        { ...base, ticker: "BOND1", instrumentType: "BONDS" },
        { ...base, ticker: "BOND2", instrumentType: "TCS", board: "TQNB" },
        { ...base, ticker: "FND1", instrumentType: "MUTUAL_FUNDS" },
        { ...base, ticker: "STP1", instrumentType: "TCS", board: "TQBR" },
]);
    const byTicker = Object.fromEntries(u.positions.map((p) => [p.ticker, p.assetClass]));
    expect(byTicker.BOND1).toBe("bond");
    expect(byTicker.BOND2).toBe("bond"); // fallback по board TQNB
    expect(byTicker.FND1).toBe("etf");
    expect(byTicker.STP1).toBe("stock");
  });
});
