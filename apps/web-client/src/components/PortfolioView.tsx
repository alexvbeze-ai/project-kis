import type { Account, UnifiedPortfolio } from "../types";
import { fmtMoney, fmtNum, fmtDateTime } from "../lib/format";
import { PositionRow } from "./PositionRow";

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

export function PortfolioView({ portfolio }: { portfolio: UnifiedPortfolio }) {
  const totalRub =
    portfolio.positions.reduce((s, p) => s + (p.marketValueRub ?? p.marketValue), 0) +
    portfolio.accounts.reduce((s, a) => s + (a.currency === "RUB" ? a.cash : 0), 0);

  const sorted = [...portfolio.positions].sort(
    (a, b) => (b.marketValueRub ?? b.marketValue) - (a.marketValueRub ?? a.marketValue),
  );

  return (
    <div className="space-y-6">
      {/* Сводка */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Стоимость портфеля</div>
          <div className="mt-1 text-2xl font-bold text-white">{fmtMoney(totalRub)}</div>
          <div className="mt-1 text-xs text-slate-500">активы + RUB-кэш, оценка ядра v0.3</div>
        </div>
        {portfolio.accounts.map((a) => (
          <div key={a.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {accountLabel(a)} · {a.id}
            </div>
            <div className="mt-1 text-2xl font-bold text-white">{fmtMoney(a.cash, a.currency)}</div>
            <div className="mt-1 text-xs text-slate-500">
              свободно{a.lockedCash > 0 ? ` · заблокировано ${fmtMoney(a.lockedCash, a.currency)}` : ""}
            </div>
          </div>
        ))}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Позиций</div>
          <div className="mt-1 text-2xl font-bold text-white">{fmtNum(portfolio.positions.length, 0)}</div>
          <div className="mt-1 text-xs text-slate-500">на {fmtDateTime(portfolio.asOf)}</div>
        </div>
      </section>

      {/* Таблица позиций */}
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-semibold text-white">Позиции</h3>
          <span className="text-xs text-slate-500">сортировка по стоимости · блоки/отрасли — v0.4</span>
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
                <th className="px-4 py-2 text-right font-medium">P&L</th>
                <th className="hidden px-4 py-2 text-right font-medium md:table-cell">За день</th>
                <th className="hidden px-4 py-2 text-right font-medium lg:table-cell">Доля</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <PositionRow key={`${p.instrumentId}`} p={p} />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Позиций пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
