import { REFRESH_OPTIONS, saveRefreshIntervalMs } from "../lib/settings";

/**
 * Выпадающая панель настроек: интервал автообновления портфеля.
 * Портфель — «экран для раздумий», поэтому по умолчанию автообновление выключено;
 * значение хранится в localStorage (см. lib/settings.ts).
 */
export function SettingsPanel({
  intervalMs,
  onChange,
  onClose,
}: {
  intervalMs: number;
  onChange: (ms: number) => void;
  onClose: () => void;
}) {
  const pick = (ms: number) => {
    saveRefreshIntervalMs(ms);
    onChange(ms);
    onClose();
  };

  return (
    <>
      {/* клик вне панели закрывает её */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl shadow-black/40">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Автообновление портфеля
        </div>
        <div className="space-y-1">
          {REFRESH_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => pick(o.value)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-slate-800 ${
                o.value === intervalMs ? "text-kis-accent" : "text-slate-300"
              }`}
            >
              <span>{o.label}</span>
              {o.value === intervalMs && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Кнопка ⟳ обновляет портфель вручную в любой момент.
        </p>
      </div>
    </>
  );
}
