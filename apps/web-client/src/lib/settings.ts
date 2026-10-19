/** Настройки клиента (localStorage): интервал автообновления портфеля. */

const REFRESH_KEY = "kis.portfolio.refreshIntervalMs";

/** По умолчанию — «не обновлять» (портфель — экран для раздумий, не онлайн-котировки). */
export const DEFAULT_REFRESH_MS = 0;

export const REFRESH_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Не обновлять" },
  { value: 30_000, label: "30 секунд" },
  { value: 60_000, label: "1 минута" },
  { value: 300_000, label: "5 минут" },
  { value: 900_000, label: "15 минут" },
  { value: 3_600_000, label: "1 час" },
];

export function loadRefreshIntervalMs(): number {
  const raw = localStorage.getItem(REFRESH_KEY);
  if (raw == null) return DEFAULT_REFRESH_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_REFRESH_MS;
}

export function saveRefreshIntervalMs(ms: number): void {
  localStorage.setItem(REFRESH_KEY, String(ms));
}

// ---------- Тема интерфейса (light/dark) ----------

const THEME_KEY = "kis.theme";
export type Theme = "dark" | "light";

export function loadTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

/** Применяет класс .dark к <html> (Tailwind darkMode:"class") и сохраняет выбор. */
export function applyTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}
