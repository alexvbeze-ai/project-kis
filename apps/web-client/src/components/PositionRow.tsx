import type { Position } from "../types";
import { fmtMoney, fmtNum, fmtPercent, plColorClass } from "../lib/format";

/** Иконка компании: свой CDN-каталог market-data (v0.3), временно — favicon брокера. */
function Logo({ position }: { position: Position }) {
  const fallbackLetter = position.ticker.charAt(0);
  if (position.logoLink) {
    return (
      <img
        src={position.logoLink}
        alt=""
        loading="lazy"
        className="h-8 w-8 rounded-full bg-slate-200 object-contain p-1 dark:bg-slate-800"
        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {fallbackLetter}
    </div>
  );
}

export function PositionRow({ p, colWidth }: { p: Position; colWidth: number }) {
  return (
    <tr className="border-b border-slate-200 bg-white transition hover:bg-slate-50 dark:border-slate-800/70 dark:bg-transparent dark:hover:bg-slate-800/40">
      <td className="px-4 py-3" style={{ width: colWidth }}>
        <div className="flex items-center gap-3">
          <Logo position={p} />
          {/* крупно — название компании/инструмента, ниже — тикер */}
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900 dark:text-white" title={p.displayName}>
              {p.shortName || p.displayName}
            </div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{p.ticker}</div>
          </div>
        </div>
      </td>
      <td className="w-[9%] px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtNum(p.quantity, p.quantity % 1 ? 2 : 0)}</td>
      <td className="hidden w-[12%] px-4 py-3 text-right tabular-nums text-slate-500 md:table-cell dark:text-slate-400">{fmtMoney(p.avgPrice, p.currency)}</td>
      <td className="w-[13%] px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{fmtMoney(p.price, p.currency)}</td>
      <td className="w-[15%] px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-white">
        {fmtMoney(p.marketValueRub ?? p.marketValue, "RUB")}
      </td>
      <td className={`w-[13%] px-4 py-3 text-right tabular-nums ${plColorClass(p.unrealizedPercentPL)}`}>
        <div>{fmtPercent(p.unrealizedPercentPL)}</div>
        <div className="text-xs opacity-70">{fmtMoney(p.unrealizedPL, p.currency)}</div>
      </td>
      <td className={`hidden w-[10%] px-4 py-3 text-right tabular-nums text-sm md:table-cell ${plColorClass(p.dailyPercentPL)}`}>
        {fmtPercent(p.dailyPercentPL)}
      </td>
      <td className="hidden w-[8%] px-4 py-3 text-right tabular-nums text-slate-500 lg:table-cell dark:text-slate-400">
        {p.portfolioShare != null ? `${fmtNum(p.portfolioShare, 1)}%` : "—"}
      </td>
    </tr>
  );
}
