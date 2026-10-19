/**
 * Маппинг ответа BCS (Portfolio[] по актуальному контракту BCS-SPEC §3.2)
 * в UnifiedPortfolio (contracts/broker-api). Старый PDF-контракт не поддерживается.
 */
import type { BcsPosition, BcsPortfolioResponse } from "../types/bcs.js";
import type { UnifiedPortfolio, UnifiedPosition, UnifiedAccount } from "../types/unified.js";

function toInstrumentId(p: BcsPosition): string {
  const ex = (p.exchange || "MOEX").toUpperCase();
  return `${ex}:${p.ticker}`;
}

function maskAccount(id: string): string {
  if (!id || id.length <= 4) return id ?? "";
  return `••••${id.slice(-4)}`;
}

export function normalizePortfolio(raw: BcsPortfolioResponse): UnifiedPortfolio {
  const positions: UnifiedPosition[] = [];
  const accounts = new Map<string, UnifiedAccount>();

  for (const p of raw.positions ?? []) {
    // Актуальный контракт: денежная позиция = type "moneyLimit" / upperType "CURRENCY".
    const isCash = p.type === "moneyLimit" || p.upperType === "CURRENCY";

    const accKey = `${p.account ?? ""}|${p.currency ?? "RUB"}`;
    if (!accounts.has(accKey)) {
      accounts.set(accKey, {
        id: maskAccount(p.account || ""),
        type: inferAccountType(p),
        currency: p.currency ?? "RUB",
        cash: 0,
        lockedCash: 0,
      });
    }
    const acc = accounts.get(accKey)!;

    if (isCash) {
      // moneyLimit: quantity — сумма в валюте цены; currentPrice для денег может отсутствовать.
      acc.cash += (p.quantity ?? 0) * (p.currentPrice || 1);
      acc.lockedCash += p.locked ?? 0;
      continue;
    }

    positions.push({
      instrumentId: toInstrumentId(p),
      ticker: p.ticker ?? "",
      displayName: p.displayName ?? p.ticker ?? "",
      quantity: p.quantity ?? 0,
      avgPrice: p.balancePrice ?? null,
      price: p.currentPrice ?? 0,
      currency: p.currency ?? "RUB",
      marketValue: p.currentValue ?? 0,
      marketValueRub: p.currentValueRub ?? null,
      unrealizedPL: p.unrealizedPL ?? null,
      unrealizedPercentPL: p.unrealizedPercentPL ?? null,
      dailyPL: p.dailyPL ?? null,
      dailyPercentPL: p.dailyPercentPL ?? null,
      portfolioShare: p.portfolioShare ?? null,
      logoLink: p.logoLink ? p.logoLink : null,
    });
  }

  return {
    broker: "bcs",
    asOf: new Date().toISOString(),
    accounts: [...accounts.values()],
    positions: positions.sort(
      (a, b) => (b.marketValueRub ?? b.marketValue) - (a.marketValueRub ?? a.marketValue),
    ),
  };
}

function inferAccountType(p: BcsPosition): UnifiedAccount["type"] {
  // subAccountId/agreementId deprecated у БКС — ориентируемся на номер торгового счёта.
  const s = `${p.account ?? ""} ${p.type ?? ""}`.toLowerCase();
  if (s.includes("iis")) return "iis";
  if (s.includes("margin")) return "margin";
  return "broker";
}
