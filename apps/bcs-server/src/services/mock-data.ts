/**
 * DEMO-режим (KIS_MOCK_BCS=1): фиктивный портфель в формате BCS API.
 * Поля = BcsPosition (BCS-SPEC §3.1), чтобы normalizePortfolio работал как в проде.
 * Любой непустой refresh-токен считается валидным. НЕ включать на публичном сервере!
 */
import type { BcsPosition, BcsPortfolioResponse } from "../types/bcs.js";

function pos(t: Partial<BcsPosition> & Pick<BcsPosition, "ticker" | "displayName">): BcsPosition {
  return {
    type: "equity",
    subAccountId: "sub-001",
    agreementId: "12345678",
    account: "12345678",
    exchange: "MOEX",
    baseAssetTicker: t.ticker,
    currency: "RUB",
    expireDate: null,
    upperType: "security",
    instrumentType: "TCS",
    term: "",
    quantity: 0,
    locked: 0,
    balancePrice: 0,
    currentPrice: 0,
    balanceValue: 0,
    balanceValueRub: 0,
    balanceValueUsd: 0,
    balanceValueEur: 0,
    currentValue: 0,
    currentUserValueRub: 0,
    currentUserValueUsd: 0,
    currentUserValueEur: 0,
    unrealizedPL: 0,
    unrealizedPercentPL: 0,
    dailyPL: 0,
    dailyPercentPL: 0,
    portfolioShare: 0,
    scale: 2,
    minimumStep: 0.01,
    board: "TQBR",
    priceUnit: 1,
    faceValue: 0,
    accruedIncome: 0,
    isBlockedTradeAccount: false,
    lockedForFutures: 0,
    isBlocked: false,
    ratioQuantity: 1,
    logoLink: "",
    ...t,
  } as BcsPosition;
}

function stock(
  ticker: string,
  displayName: string,
  quantity: number,
  balancePrice: number,
  currentPrice: number,
): BcsPosition {
  const currentValue = +(quantity * currentPrice).toFixed(2);
  const balanceValue = +(quantity * balancePrice).toFixed(2);
  const unrealizedPL = +(currentValue - balanceValue).toFixed(2);
  // псевдослучайная «закрытие вчера» — детерминированно от тикера
  const seed = [...ticker].reduce((s, c) => s + c.charCodeAt(0), 0);
  const prev = +(currentPrice * (0.985 + ((seed % 31) / 1000))).toFixed(2);
  return pos({
    ticker,
    displayName,
    quantity,
    balancePrice,
    currentPrice,
    balanceValue,
    balanceValueRub: balanceValue,
    currentValue,
    currentUserValueRub: currentValue,
    unrealizedPL,
    unrealizedPercentPL: +((unrealizedPL / balanceValue) * 100).toFixed(2),
    dailyPL: +((currentPrice - prev) * quantity).toFixed(2),
    dailyPercentPL: +(((currentPrice - prev) / prev) * 100).toFixed(2),
  });
}

function cash(quantity: number, agreementId: string, accountLabel: string): BcsPosition {
  return pos({
    ticker: "RUB",
    displayName: "Денежные средства",
    type: "money",
    upperType: "money",
    instrumentType: "CASH",
    quantity,
    currentPrice: 1,
    balancePrice: 1,
    currentValue: quantity,
    currentUserValueRub: quantity,
    balanceValue: quantity,
    balanceValueRub: quantity,
    agreementId,
    account: accountLabel,
    exchange: "CCP",
  });
}

export function mockBcsPortfolio(): BcsPortfolioResponse {
  const positions: BcsPosition[] = [
    stock("LKOH", "ЛУКОЙЛ", 14, 6890.0, 7240.5),
    stock("SB", "Сбербанк", 60, 289.1, 312.4),
    stock("GAZP", "Газпром", 110, 142.6, 138.2),
    stock("ROSNEFT", "Роснефть", 45, 465.2, 478.0),
    stock("MGNT", "Магнит", 18, 3980.5, 3610.0),
    stock("VTBR", "ВТБ", 15000, 68.4, 72.1),
    stock("TMTK", "ТМК", 900, 71.0, 78.4),
    stock("SOLG", "Соллерс", 11, 990.0, 1042.0),
    stock("IRAO", "Интер РАО", 130, 14.1, 15.2),
    stock("LQDT", "Фонд Ликвидность", 140, 110.1, 112.3),
    cash(184_320.55, "12345678", "Б4567***1234"),
    cash(42_100.0, "IIS-7788", "ИИС 7788"),
  ];
  const total = positions.reduce((s, p) => s + p.currentUserValueRub, 0);
  for (const p of positions) p.portfolioShare = +((p.currentUserValueRub / total) * 100).toFixed(2);
  return { positions };
}
