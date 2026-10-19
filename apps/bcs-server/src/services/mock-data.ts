/**
 * DEMO-режим (KIS_MOCK_BCS=1): фиктивный портфель в формате АКТУАЛЬНОГО контракта БКС
 * (BCS-SPEC §3.2, llms-full.txt от 19.10.2026): голый массив Portfolio[],
 * type ∈ moneyLimit|depoLimit|..., upperType ∈ CURRENCY|RUSSIA|FOREIGN|OTC,
 * currentValueRub/Usd/Eur. Любой непустой refresh-токен считается валидным.
 * НЕ включать на публичном сервере!
 */
import type { BcsPosition, BcsPortfolioResponse } from "../types/bcs.js";

function pos(t: Partial<BcsPosition> & Pick<BcsPosition, "ticker" | "displayName">): BcsPosition {
  return {
    type: "depoLimit",
    account: "74567***1234",
    exchange: "MOEX",
    baseAssetTicker: t.ticker,
    currency: "RUB",
    expireDate: undefined,
    upperType: "RUSSIA",
    instrumentType: "TCS",
    term: "T1",
    quantity: 0,
    locked: 0,
    balancePrice: 0,
    currentPrice: 0,
    balanceValue: 0,
    balanceValueRub: 0,
    balanceValueUsd: 0,
    balanceValueEur: 0,
    currentValue: 0,
    currentValueRub: 0,
    currentValueUsd: 0,
    currentValueEur: 0,
    unrealizedPL: 0,
    unrealizedPercentPL: 0,
    dailyPL: 0,
    dailyPercentPL: 0,
    portfolioShare: 0,
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
    ...t,
  };
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
    currentValueRub: currentValue,
    unrealizedPL,
    unrealizedPercentPL: +((unrealizedPL / balanceValue) * 100).toFixed(2),
    dailyPL: +((currentPrice - prev) * quantity).toFixed(2),
    dailyPercentPL: +(((currentPrice - prev) / prev) * 100).toFixed(2),
  });
}

function cash(quantity: number, account: string): BcsPosition {
  return pos({
    ticker: "RUB",
    displayName: "Денежные средства",
    type: "moneyLimit",
    upperType: "CURRENCY",
    instrumentType: "CURRENCY",
    account,
    quantity,
    currentPrice: 1,
    balancePrice: 1,
    currentValue: quantity,
    currentValueRub: quantity,
    balanceValue: quantity,
    balanceValueRub: quantity,
    exchange: "MOEX",
    board: "CCP",
  });
}

export function mockBcsPortfolio(): BcsPortfolioResponse {
  const bond = (
    ticker: string,
    displayName: string,
    quantity: number,
    balancePrice: number,
    currentPrice: number,
  ): BcsPosition => ({
    ...stock(ticker, displayName, quantity, balancePrice, currentPrice),
    instrumentType: "BONDS",
    board: "TQNB",
    faceValue: 1000,
    accruedIncome: +(quantity * (currentPrice - balancePrice) * 0.05).toFixed(2),
  });

  const fund = stock("LQDT", "Фонд Ликвидность", 140, 110.1, 112.3);
  fund.instrumentType = "MUTUAL_FUNDS";
  fund.board = "TCMF";

  const positions: BcsPosition[] = [
    stock("LKOH", "ЛУКОЙЛ", 14, 6890.0, 7240.5),
    // Демонстрация BCS-SPEC §3.4: тот же инструмент приходит несколькими записями
    // (разные term + locked-часть) — normalize агрегирует их в одну строку UI.
    pos({ ticker: "SB", displayName: "Сбербанк", quantity: 40, balancePrice: 289.1, currentPrice: 312.4, term: "T1" }),
    pos({ ticker: "SB", displayName: "Сбербанк", quantity: 20, balancePrice: 289.5, currentPrice: 312.4, term: "T0", locked: 5 }),
    stock("GAZP", "Газпром", 110, 142.6, 138.2),
    stock("TRNFP", "Транснефть ап", 30, 1420.0, 1518.4),
    stock("MGNT", "Магнит", 18, 3980.5, 3610.0),
    bond("SU26216", "ОФЗ 26216", 30, 84.9, 87.2),
    bond("SU26243", "ОФЗ 26243", 20, 71.4, 73.05),
    fund,
    cash(184_320.55, "74567***1234"),
    cash(42_100.0, "IIS-7788"),
  ];
  return { positions };
}
