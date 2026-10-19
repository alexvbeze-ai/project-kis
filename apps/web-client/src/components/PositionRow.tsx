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
        className="h-8 w-8 rounded-full bg-slate-800 object-contain p-1"
        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
      {fallbackLetter}
    </div>
  );
}

export function PositionRow({ p }: { p: Position }) {
  return (
    <tr className="border-b border-slate-800/70 transition hover:bg-slate-800/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo position={p} />
          <div>
            <div className="font-semibold text-white">{p.ticker}</div>
            <div className="max-w-[220px] truncate text-xs text-slate-400" title={p.displayName}>
              {p.displayName}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{fmtNum(p.quantity, p.quantity % 1 ? 2 : 0)}</td>
      <td className="hidden px-4 py-3 text-right tabular-nums text-slate-400 md:table-cell">{fmtMoney(p.avgPrice, p.currency)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-200">{fmtMoney(p.price, p.currency)}</td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-white">
        {fmtMoney(p.marketValueRub ?? p.marketValue, "RUB")}
      </td>
      <td className={`px-4 py-3 text-right tabular-nums ${plColorClass(p.unrealizedPercentPL)}`}>
        <div>{fmtPercent(p.unrealizedPercentPL)}</div>
        <div className="text-xs opacity-70">{fmtMoney(p.unrealizedPL, p.currency)}</div>
      </td>
      <td className={`hidden px-4 py-3 text-right tabular-nums text-sm md:table-cell ${plColorClass(p.dailyPercentPL)}`}>
        {fmtPercent(p.dailyPercentPL)}
      </td>
      <td className="hidden px-4 py-3 text-right tabular-nums text-slate-400 lg:table-cell">
        {p.portfolioShare != null ? `${fmtNum(p.portfolioShare, 1)}%` : "—"}
      </td>
    </tr>
  );
}
