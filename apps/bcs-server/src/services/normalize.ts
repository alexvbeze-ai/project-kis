/**
 * Маппинг ответа BCS (Portfolio[] по актуальному контракту BCS-SPEC §3.2)
 * в UnifiedPortfolio (contracts/broker-api). Старый PDF-контракт не поддерживается.
 *
 * ВАЖНО (BCS-SPEC §3.4): БКС возвращает ОДИН инструмент несколькими записями
 * (разные term/board/счета/locked-часть — «сырые» остатки биржи). Перед отдачей
 * ядру позиции АГРЕГИРУЮТСЯ по (account, exchange, ticker, currency):
 * количества и стоимости суммируются, средневзвешенная цена пересчитывается,
 * portfolioShare / unrealizedPercentPL / dailyPercentPL — тоже.
 */
import type { BcsPosition, BcsPortfolioRaw } from "../types/bcs.js";
import type {
  UnifiedPortfolio,
  UnifiedPosition,
  UnifiedAccount,
  AssetClass,
} from "../types/unified.js";
import { makeShortName } from "../types/unified.js";

function toInstrumentId(p: BcsPosition): string {
  const ex = (p.exchange || "MOEX").toUpperCase();
  return `${ex}:${p.ticker}`;
}

function maskAccount(id: string): string {
  if (!id || id.length <= 4) return id ?? "";
  return `••••${id.slice(-4)}`;
}

/**
 * Классификация инструмента по enum instrumentType (BCS-SPEC §3.2) с fallback
 * по коду класса расчётов board и облигационным полям (faceValue/accruedIncome).
 */
export function classifyAssetClass(p: BcsPosition): AssetClass {
  const t = (p.instrumentType ?? "").toUpperCase();
  switch (t) {
    case "STOCK":
    case "FOREIGN_STOCK":
    case "DEPOSITARY_RECEIPTS":
      return "stock";
    case "BONDS":
    case "EURO_BONDS":
    case "NOTES":
      return "bond";
    case "MUTUAL_FUNDS":
    case "ETF":
      return "etf";
    case "CURRENCY":
      return "currency";
  }
  // Fallback: в портфеле instrumentType может содержать код класса расчётов (TCS, ACRN…)
  const board = (p.board ?? "").toUpperCase();
  if (board === "TQNB" || board === "SNDX" || board === "TFFY") return "bond";
  if ((p.faceValue ?? 0) > 0 || (p.accruedIncome ?? 0) !== 0) return "bond";
  if (board === "TCMF" || /FXB?|EQBD/.test(board)) return "etf";
  if (p.upperType === "CURRENCY") return "currency";
  if (board === "TQBR" || p.upperType === "RUSSIA" || p.upperType === "FOREIGN") return "stock";
  return "other";
}

interface Agg {
  key: string;
  rep: BcsPosition; // запись-представитель (максимальная стоимость) для метаданных
  rowsList: BcsPosition[]; // все исходные строки — для взвешенной агрегации percent-полей
  quantity: number;
  locked: number;
  balanceQtyValue: number; // Σ qty·balancePrice — для взвешенной средней
  balanceValueRub: number;
  currentValue: number;
  currentValueRub: number;
  unrealizedPL: number;
  dailyPL: number;
  rows: number;
}

function num(v: number | undefined | null): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Агрегация сырых строк портфеля по инструменту в рамках счёта (BCS-SPEC §3.4). */
function aggregateByInstrument(rows: BcsPosition[]): Agg[] {
  const map = new Map<string, Agg>();
  for (const p of rows) {
    const key = [p.account ?? "", (p.exchange ?? "MOEX").toUpperCase(), p.ticker ?? "", p.currency ?? "RUB"].join("|");
    let a = map.get(key);
    if (!a) {
      a = { key, rep: p, rowsList: [], quantity: 0, locked: 0, balanceQtyValue: 0, balanceValueRub: 0, currentValue: 0, currentValueRub: 0, unrealizedPL: 0, dailyPL: 0, rows: 0 };
      map.set(key, a);
    }
    a.rowsList.push(p);
    const q = num(p.quantity);
    a.quantity += q;
    a.locked += num(p.locked);
    a.balanceQtyValue += q * num(p.balancePrice);
    a.balanceValueRub += num(p.balanceValueRub ?? p.balanceValue);
    a.currentValue += num(p.currentValue);
    // currentValueRub может отсутствовать у БКС — оцениваем из стоимости в валюте цены.
    a.currentValueRub += p.currentValueRub != null ? num(p.currentValueRub) : num(p.currentValue);
    a.unrealizedPL += num(p.unrealizedPL);
    a.dailyPL += num(p.dailyPL);
    a.rows += 1;
    const curVal = num(p.currentValueRub ?? p.currentValue);
    const repVal = num(a.rep.currentValueRub ?? a.rep.currentValue);
    if (curVal > repVal) a.rep = p; // метаданные (цена, scale, board…) — из самой дорогой записи
  }
  return [...map.values()];
}

export function normalizePortfolio(raw: BcsPortfolioRaw): UnifiedPortfolio {
  const positions: UnifiedPosition[] = [];
  const accounts = new Map<string, UnifiedAccount>();

  const all = Array.isArray(raw) ? raw : [];

  for (const p of all) {
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
    if (isCash) {
      const acc = accounts.get(accKey)!;
      // moneyLimit: quantity — сумма в валюте цены; currentPrice для денег может отсутствовать.
      acc.cash += num(p.quantity) * (p.currentPrice || 1);
      acc.lockedCash += num(p.locked);
    }
  }

  // Инструментальные строки (depoLimit/otcLimit/futures*) — агрегируем дубли (§3.4).
  const instrumentRows = all.filter((p) => !(p.type === "moneyLimit" || p.upperType === "CURRENCY"));
  const aggs = aggregateByInstrument(instrumentRows);

  const totalRub = aggs.reduce((s, a) => s + a.currentValueRub, 0);

  for (const a of aggs) {
    const rep = a.rep;
    const assetClass = classifyAssetClass(rep);
    const avgPrice = a.quantity > 0 ? a.balanceQtyValue / a.quantity : null;
    const price = num(rep.currentPrice);
    const marketValueRub = a.currentValueRub || a.quantity * price;
    const balanceValueRub = a.balanceValueRub || (avgPrice != null ? a.quantity * avgPrice : null);
    // Дневная динамика: приоритет — фактическое поле БКС changePercentage
    // (отсутствует в swagger, но приходит в ответе; см. BCS-SPEC §3.4), затем
    // dailyPercentPL (взвешивание по стоимости); fallback — расчёт из dailyPL
    // относительно предыдущей стоимости позиции.
    const prevValueRub = marketValueRub - a.dailyPL;
    const dailyPctFallback = prevValueRub > 0 ? (a.dailyPL / prevValueRub) * 100 : null;
    let dailyPctSum = 0;
    let dailyPctWeight = 0;
    for (const r of a.rowsList) {
      const v = r.changePercentage ?? r.dailyPercentPL;
      if (v == null) continue;
      const w = num(r.currentValueRub ?? r.currentValue);
      dailyPctSum += v * (w > 0 ? w : 1);
      dailyPctWeight += w > 0 ? w : 1;
    }
    const dailyPct = dailyPctWeight > 0 ? dailyPctSum / dailyPctWeight : dailyPctFallback;

    // Прирост с момента открытия: приоритет — собственное поле БКС
    // unrealizedPercentPL (взвешивание по балансовой стоимости); fallback —
    // расчёт из абсолютного unrealizedPL.
    let uplpSum = 0;
    let uplpWeight = 0;
    for (const r of a.rowsList) {
      if (r.unrealizedPercentPL == null) continue;
      const w = num(r.balanceValueRub ?? r.balanceValue);
      uplpSum += r.unrealizedPercentPL * (w > 0 ? w : 1);
      uplpWeight += w > 0 ? w : 1;
    }
    const unrealizedPct =
      uplpWeight > 0
        ? uplpSum / uplpWeight
        : balanceValueRub && balanceValueRub > 0
          ? (a.unrealizedPL / balanceValueRub) * 100
          : null;

    positions.push({
      instrumentId: toInstrumentId(rep),
      ticker: rep.ticker ?? "",
      displayName: rep.displayName ?? rep.ticker ?? "",
      assetClass,
      shortName: makeShortName(rep.ticker ?? "", rep.displayName, assetClass),
      instrumentType: rep.instrumentType ?? null,
      quantity: a.quantity,
      avgPrice,
      price,
      currency: rep.currency ?? "RUB",
      marketValue: a.currentValue,
      marketValueRub,
      balanceValueRub,
      unrealizedPL: a.unrealizedPL,
      unrealizedPercentPL: unrealizedPct,
      dailyPL: a.dailyPL,
      dailyPercentPL: dailyPct,
      portfolioShare: totalRub > 0 ? (marketValueRub / totalRub) * 100 : null,
      logoLink: rep.logoLink ? rep.logoLink : null,
    });
  }

  return {
    broker: "bcs",
    asOf: new Date().toISOString(),
    accounts: [...accounts.values()],
    positions: positions.sort(
      (x, y) => (y.marketValueRub ?? y.marketValue) - (x.marketValueRub ?? x.marketValue),
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
