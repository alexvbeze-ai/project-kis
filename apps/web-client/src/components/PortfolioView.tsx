import type { Account, AssetClass, Position, UnifiedPortfolio } from "../types";
import { fmtMoney, fmtNum, fmtPercent, plColorClass } from "../lib/format";
import { PositionRow } from "./PositionRow";
import { RubleIcon, TrendUpIcon } from "./icons";

function accountLabel(a: Account): string {
  switch (a.type) {
    case "iis":
      return "ИИС";
    case "margin":
      return "Маржинальный";
    default:
      return "Брокерский";
  }
}

/** Текущая стоимость позиции в рублях (fallback — стоимость в валюте цены). */
function curRub(p: Position): number {
  return p.marketValueRub ?? p.marketValue;
}
/** Балансовая стоимость позиции в рублях (fallback — текущая, если данных нет). */
function balRub(p: Position): number {
  return p.balanceValueRub ?? curRub(p);
}

const CLASS_META: Record<AssetClass, { title: string; hint: string }> = {
  stock: { title: "Акции", hint: "акции и депозитарные расписки" },
  bond: { title: "Облигации", hint: "государственные и корпоративные выпуски" },
  etf: { title: "Фонды", hint: "биржевые паевые фонды" },
  currency: { title: "Валюта", hint: "валютные позиции" },
  other: { title: "Прочее", hint: "иные инструменты" },
};

/** Секция-таблица одного класса активов: заголовок с итогами + строки позиций. */
function AssetSection({
  cls,
  positions,
  totalPortfolioRub,
}: {
  cls: AssetClass;
  positions: Position[];
  totalPortfolioRub: number;
}) {
  const meta = CLASS_META[cls];
  const current = positions.reduce((s, p) => s + curRub(p), 0);
  const balance = positions.reduce((s, p) => s + balRub(p), 0);
  const growth = current - balance;
  const growthPct = balance > 0 ? (growth / balance) * 100 : null;
  const share = totalPortfolioRub > 0 ? (current / totalPortfolioRub) * 100 : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-slate-800 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h3 className="font-semibold text-white">{meta.title}</h3>
          <span className="text-xs text-slate-500">
            {fmtNum(positions.length, 0)} шт · {meta.hint}
          </span>
        </div>
        <div className="flex items-baseline gap-4 text-sm">
          <span className="tabular-nums text-slate-300">{fmtMoney(current)}</span>
          <span className={`tabular-nums ${plColorClass(growth)}`}>{fmtPercent(growthPct)}</span>
          {share != null && (
            <span className="hidden tabular-nums text-xs text-slate-500 sm:inline">
              доля {fmtNum(share, 1)}%
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 font-medium">Инструмент</th>
              <th className="px-4 py-2 text-right font-medium">Кол-во</th>
              <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Средн. цена</th>
              <th className="px-4 py-2 text-right font-medium">Цена</th>
              <th className="px-4 py-2 text-right font-medium">Стоимость</th>
              <th className="px-4 py-2 text-right font-medium">Прирост</th>
              <th className="hidden px-4 py-2 text-right font-medium md:table-cell">За день</th>
              <th className="hidden px-4 py-2 text-right font-medium lg:table-cell">Доля</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <PositionRow key={`${p.instrumentId}`} p={p} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PortfolioView({ portfolio }: { portfolio: UnifiedPortfolio }) {
  // одна позиция на инструмент после агрегации дублей (BCS-SPEC §3.4)
  const sorted = [...portfolio.positions].sort((a, b) => curRub(b) - curRub(a));

  const assetsCurrent = sorted.reduce((s, p) => s + curRub(p), 0);
  const assetsBalance = sorted.reduce((s, p) => s + balRub(p), 0);
  const cashRub = portfolio.accounts.reduce((s, a) => s + (a.currency === "RUB" ? a.cash : 0), 0);
  const totalCurrent = assetsCurrent + cashRub;
  const totalBalance = assetsBalance + cashRub;
  const growth = totalCurrent - totalBalance;
  const growthPct = totalBalance > 0 ? (growth / totalBalance) * 100 : null;

  // Группировка по классу актива; порядок секций фиксированный, внутри — по стоимости
  const groups: [AssetClass, Position[]][] = [];
  for (const cls of ["stock", "bond", "etf", "currency", "other"] as AssetClass[]) {
    const list = sorted.filter((p) => p.assetClass === cls);
    if (list.length > 0) groups.push([cls, list]);
  }

  return (
    <div className="space-y-6">
      {/* Сводка: стоимость портфеля (балансовая vs текущая + прирост) и свободные средства */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Стоимость портфеля
          </div>
          <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
            <div className="text-3xl font-bold text-white">{fmtMoney(totalCurrent)}</div>
            <div className={`flex items-center gap-1 text-sm font-medium ${plColorClass(growth)}`}>
              <TrendUpIcon className={`h-4 w-4 ${growth < 0 ? "-scale-y-100" : ""}`} />
              <span>
                {growth >= 0 ? "+" : ""}
                {fmtMoney(growth)} ({fmtPercent(growthPct)})
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            по балансной цене: {fmtMoney(totalBalance)} · активы {fmtMoney(assetsCurrent)} +
            свободно {fmtMoney(cashRub)}
          </div>
        </div>

        {/* Свободные средства по счетам — справа, с ₽ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:w-72 lg:grid-cols-1">
          {portfolio.accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4"
            >
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {accountLabel(a)} · {a.id}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600">
                  свободно{a.lockedCash > 0 ? ` · занято ${fmtMoney(a.lockedCash, a.currency)}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-lg font-semibold text-white">
                {a.currency === "RUB" ? (
                  <RubleIcon className="h-4 w-4 text-kis-accent" />
                ) : (
                  <span className="text-xs text-slate-400">{a.currency}</span>
                )}
                <span className="tabular-nums">{fmtMoney(a.cash, a.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Таблицы по типам активов */}
      {groups.map(([cls, list]) => (
        <AssetSection key={cls} cls={cls} positions={list} totalPortfolioRub={totalCurrent} />
      ))}

      {groups.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-12 text-center text-slate-500">
          Позиций пока нет
        </div>
      )}
    </div>
  );
}
