import { useState } from "react";
import {
  REFRESH_OPTIONS,
  applyTheme,
  loadTheme,
  saveRefreshIntervalMs,
  type Theme,
} from "../lib/settings";

/**
 * Выпадающая панель настроек:
 *  — интервал автообновления портфеля (по умолчанию «не обновлять»);
 *  — тема интерфейса (светлая/тёмная);
 *  — управление refresh-токеном (обновить / отключить).
 */
export function SettingsPanel({
  intervalMs,
  onChange,
  onClose,
  onTokenChange,
  onDisconnect,
}: {
  intervalMs: number;
  onChange: (ms: number) => void;
  onClose: () => void;
  /** Пользователь вставил новый refresh-токен — приложение переподключается. */
  onTokenChange: (token: string) => void;
  /** Отключить токен (переход на экран подключения). */
  onDisconnect: () => void;
}) {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [replacing, setReplacing] = useState(false);
  const [newToken, setNewToken] = useState("");

  const pick = (ms: number) => {
    saveRefreshIntervalMs(ms);
    onChange(ms);
    onClose();
  };

  const switchTheme = (t: Theme) => {
    applyTheme(t);
    setTheme(t);
  };

  const submitToken = () => {
    const t = newToken.trim();
    if (!t) return;
    onTokenChange(t);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* затемнение + клик вне панели закрывает её */}
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] dark:bg-black/50" onClick={onClose} aria-hidden />
      {/* панель прижата к правому верхнему углу окна — там же, где кнопка шестерёнки */}
      <div className="absolute right-4 top-16 max-h-[calc(100vh-5rem)] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl shadow-black/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
        {/* ---- Тема ---- */}
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Тема
        </div>
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(["light", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTheme(t)}
              className={`rounded-md px-2 py-1.5 text-sm transition ${
                theme === t
                  ? "bg-white font-medium text-slate-900 shadow dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t === "light" ? "Светлая" : "Тёмная"}
            </button>
          ))}
        </div>

        {/* ---- Автообновление ---- */}
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Автообновление портфеля
        </div>
        <div className="space-y-1">
          {REFRESH_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => pick(o.value)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                o.value === intervalMs ? "text-kis-accent" : "text-slate-600 dark:text-slate-300"
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

        {/* ---- Токен ---- */}
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Refresh-токен брокера
          </div>
          {!replacing ? (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setReplacing(true)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Обновить токен…
              </button>
              <button
                onClick={onDisconnect}
                className="rounded-lg border border-red-200 px-3 py-2 text-left text-sm text-kis-down transition hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40"
              >
                Отключить токен
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                rows={3}
                placeholder="Вставьте новый refresh-токен из кабинета БКС"
                className="w-full resize-none rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-kis-accent dark:border-slate-700 dark:text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitToken}
                  disabled={!newToken.trim()}
                  className="flex-1 rounded-lg bg-kis-accent px-3 py-2 text-sm font-medium text-slate-950 transition hover:brightness-110 disabled:opacity-40"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => {
                    setReplacing(false);
                    setNewToken("");
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
