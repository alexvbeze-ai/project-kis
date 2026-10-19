/** Форматирование чисел/валют для портфеля (ru-RU). */

const nf = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat("ru-RU", opts);

export function fmtMoney(v: number | null | undefined, currency = "RUB"): string {
  if (v == null || Number.isNaN(v)) return "—";
  return nf({ style: "currency", currency, maximumFractionDigits: 2 }).format(v);
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return nf({ maximumFractionDigits: digits }).format(v);
}

export function fmtPercent(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${nf({ maximumFractionDigits: 2 }).format(v)}%`;
}

/** Цвет по знаку P&L: зелёный/красный/нейтральный. */
export function plColorClass(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-slate-400";
  return v > 0 ? "text-kis-up" : "text-kis-down";
}

export function fmtDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}
