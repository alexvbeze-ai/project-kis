import { useCallback, useEffect, useRef, useState } from "react";
import type { UnifiedPortfolio } from "./types";
import { ApiError } from "./types";
import { fetchPortfolio } from "./lib/api";
import {
  clearToken,
  getMode,
  loadToken,
  saveToken,
  setMode,
  type StorageMode,
} from "./lib/tokenStore";
import { ConnectScreen } from "./components/ConnectScreen";
import { PortfolioView } from "./components/PortfolioView";
import { SettingsPanel } from "./components/SettingsPanel";
import { RefreshIcon, SettingsIcon } from "./components/icons";
import { applyTheme, loadRefreshIntervalMs, loadTheme } from "./lib/settings";

const BROKER = "bcs"; // MVP: клиент не знает о брокерах — это просто id подключения

type Screen = "connect" | "portfolio";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => (loadToken() ? "portfolio" : "connect"));
  const [token, setToken] = useState<string>(() => loadToken() ?? "");
  const [mode, setModeState] = useState<StorageMode>(() => getMode());
  const [portfolio, setPortfolio] = useState<UnifiedPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshMs, setRefreshMs] = useState<number>(() => loadRefreshIntervalMs());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  // тема применяется при старте (анти-FOUC-скрипт в index.html делает то же заранее)
  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  /**
   * Загрузка портфеля. Актуальный refresh-токен всегда читается из хранилища,
   * а не из state — это позволяет useEffect автообновления НЕ зависеть от
   * токена и не пересоздаваться на каждую ротацию Keycloak.
   */
  const load = useCallback(async () => {
    const activeToken = loadToken();
    if (!activeToken) return;
    setLoading(true);
    try {
      const { portfolio: p, rotatedRefreshToken } = await fetchPortfolio({
        broker: BROKER,
        refreshToken: activeToken,
      });
      if (rotatedRefreshToken) {
        saveToken(rotatedRefreshToken);
      }
      setPortfolio(p);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.isUnauthorized) {
        // токен протух — чистим и просим ввести заново
        clearToken();
        setPortfolio(null);
        setScreen("connect");
        setError("Токен недействителен или истёк. Вставьте актуальный refresh-токен.");
      } else {
        setError(e instanceof Error ? e.message : "Неизвестная ошибка");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Первая загрузка при входе на экран портфеля + автообновление из настроек
  // (0 = «не обновлять» — портфель это экран для раздумий, а не онлайн-котировки).
  //
  // ВНИМАНИЕ: в зависимостях НЕ должно быть `token` и `load`:
  //   • load менял setToken при ротации refresh-токена → effect пересоздавался
  //     → снова вызывал load → снова ротация… — бесконечный шторм запросов
  //     к БКС (~5 RPS), даже когда в настройках выбрано «Не обновлять».
  //   • Актуальный токен load() сам читает из хранилища (loadToken()).
  // Effect живёт ровно одну сессию экрана: перезапуск только при смене
  // screen или интервала refreshMs.
  const sessionRef = useRef(0);
  useEffect(() => {
    if (screen !== "portfolio") return;
    const session = ++sessionRef.current;
    let cancelled = false;
    const run = () => {
      if (!cancelled && session === sessionRef.current) load();
    };
    run();
    if (refreshMs > 0) {
      timerRef.current = window.setInterval(run, refreshMs);
    }
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [screen, refreshMs, load]);

  const onConnect = async (newToken: string, newMode: StorageMode) => {
    setModeState(newMode);
    setMode(newMode);
    saveToken(newToken);
    setToken(newToken);
    setError(null);
    // саму загрузку выполнит effect входа на экран портфеля — ровно один запрос
    setScreen("portfolio");
  };

  const disconnect = () => {
    clearToken();
    setToken("");
    setPortfolio(null);
    setError(null);
    setScreen("connect");
  };

  /** Замена токена из панели настроек: сохраняем новый и перезагружаем портфель. */
  const replaceToken = async (newToken: string) => {
    saveToken(newToken);
    setToken(newToken);
    setError(null);
    setSettingsOpen(false);
    setScreen("portfolio");
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-700 transition-colors dark:bg-slate-950 dark:text-slate-200">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kis-accent font-black text-slate-950">
              K
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">KIS</h1>
              <p className="text-xs text-slate-500">Кабинет инвестиционной стратегии · MVP</p>
            </div>
          </div>
          {screen === "portfolio" && (
            <div className="flex items-center gap-2">
              {/* Обновить — элегантная иконка ⟳ */}
              <button
                onClick={() => load()}
                disabled={loading}
                title="Обновить портфель"
                aria-label="Обновить портфель"
                className="rounded-lg border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              {/* Настройки — тема, интервал автообновления, управление токеном */}
              <div className="relative">
                <button
                  onClick={() => setSettingsOpen((v) => !v)}
                  title="Настройки"
                  aria-label="Настройки"
                  aria-expanded={settingsOpen}
                  className={`rounded-lg border p-2 transition ${
                    settingsOpen
                      ? "border-kis-accent/60 bg-slate-100 text-kis-accent dark:bg-slate-800"
                      : "border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <SettingsIcon className="h-4 w-4" />
                </button>
                {settingsOpen && (
                  <SettingsPanel
                    intervalMs={refreshMs}
                    onChange={setRefreshMs}
                    onClose={() => setSettingsOpen(false)}
                    onTokenChange={replaceToken}
                    onDisconnect={() => {
                      setSettingsOpen(false);
                      disconnect();
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {screen === "connect" ? (
          <ConnectScreen
            initialToken={token}
            initialMode={mode}
            onConnect={onConnect}
            busy={loading}
            error={error}
          />
        ) : portfolio ? (
          <>
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-kis-down dark:border-red-900 dark:bg-red-950/50">
                {error} (показаны последние полученные данные)
              </div>
            )}
            <PortfolioView portfolio={portfolio} />
          </>
        ) : (
          <div className="mt-20 text-center text-slate-500">
            {loading ? "Загружаем портфель…" : <span className="text-kis-down">{error ?? "Нет данных"}</span>}
            {!loading && error && (
              <div className="mt-4">
                <button
                  onClick={() => setScreen("connect")}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Изменить токен
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
