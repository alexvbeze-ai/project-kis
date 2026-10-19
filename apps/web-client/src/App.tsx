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

const BROKER = "bcs"; // MVP: клиент не знает о брокерах — это просто id подключения
const AUTO_REFRESH_MS = 60_000;

type Screen = "connect" | "portfolio";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => (loadToken() ? "portfolio" : "connect"));
  const [token, setToken] = useState<string>(() => loadToken() ?? "");
  const [mode, setModeState] = useState<StorageMode>(() => getMode());
  const [portfolio, setPortfolio] = useState<UnifiedPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  /** Загрузить портфель; при ротации токена — перезаписать его в браузере. */
  const load = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    try {
      const { portfolio: p, rotatedRefreshToken } = await fetchPortfolio({
        broker: BROKER,
        refreshToken: t,
      });
      if (rotatedRefreshToken) {
        saveToken(rotatedRefreshToken);
        setToken(rotatedRefreshToken);
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

  // автообновление + первая загрузка на экране портфеля
  useEffect(() => {
    if (screen !== "portfolio") return;
    load(token);
    timerRef.current = window.setInterval(() => load(token), AUTO_REFRESH_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [screen, token, load]);

  const onConnect = async (newToken: string, newMode: StorageMode) => {
    setModeState(newMode);
    setMode(newMode);
    saveToken(newToken);
    setToken(newToken);
    setError(null);
    setLoading(true);
    await load(newToken);
    setScreen("portfolio");
  };

  const disconnect = () => {
    clearToken();
    setToken("");
    setPortfolio(null);
    setError(null);
    setScreen("connect");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kis-accent font-black text-slate-950">
              K
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">KIS</h1>
              <p className="text-xs text-slate-500">Кабинет инвестиционной стратегии · MVP</p>
            </div>
          </div>
          {screen === "portfolio" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(token)}
                disabled={loading}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm transition hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Обновляется…" : "⟳ Обновить"}
              </button>
              <button
                onClick={disconnect}
                className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-kis-down transition hover:bg-red-950/40"
              >
                Отключить токен
              </button>
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
              <div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-kis-down">
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
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
                >
                  Изменить токен
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-center text-xs text-slate-600">
        Ticker-данные предоставлены брокером. Котировки МосБиржи и иконки компаний — в v0.3
        (market-data-server). Не является инвестиционной рекомендацией.
      </footer>
    </div>
  );
}
