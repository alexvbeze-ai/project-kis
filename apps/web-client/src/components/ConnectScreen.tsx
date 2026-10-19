import { useState } from "react";
import type { StorageMode } from "../lib/tokenStore";

interface Props {
  initialToken: string;
  initialMode: StorageMode;
  onConnect: (token: string, mode: StorageMode) => void;
  busy?: boolean;
  error?: string | null;
}

/**
 * Экран подключения: пользователь вставляет refresh-токен БКС и выбирает,
 * где его хранить в браузере. Токен НИКОГДА не сохраняется на серверах KIS.
 */
export function ConnectScreen({ initialToken, initialMode, onConnect, busy, error }: Props) {
  const [token, setToken] = useState(initialToken);
  const [mode, setMode] = useState<StorageMode>(initialMode);
  const [showToken, setShowToken] = useState(false);

  const valid = token.trim().length > 20;

  return (
    <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
      <h2 className="text-2xl font-bold text-white">Подключение к брокеру</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Вставьте <span className="text-slate-200">refresh-токен</span> вашего кабинета БКС.
        Мы получаем его у брокера и используем только для запроса портфеля.
      </p>

      <div className="mt-6 space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Refresh token
        </label>
        <div className="relative">
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="eyJhbGciOi..."
            className={`w-full resize-none rounded-lg border bg-slate-950 p-3 pr-20 font-mono text-sm text-slate-200 outline-none transition focus:border-kis-accent ${
              token && !valid ? "border-kis-down" : "border-slate-700"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowToken((s) => !s)}
            className="absolute right-2 top-2 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
          >
            {showToken ? "скрыть" : "показать"}
          </button>
          {token && !valid && (
            <p className="text-xs text-kis-down">Похоже, токен неполный — проверьте, что скопировали целиком.</p>
          )}
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Где хранить токен в браузере
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
              mode === "session"
                ? "border-kis-accent bg-slate-800/60"
                : "border-slate-700 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              className="mr-2 accent-yellow-400"
              checked={mode === "session"}
              onChange={() => setMode("session")}
            />
            <span className="font-medium text-slate-200">Только до закрытия вкладки</span>
            <p className="mt-1 text-xs text-slate-400">
              sessionStorage. Безопаснее: при закрытии браузера токен исчезает.
            </p>
          </label>
          <label
            className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
              mode === "local"
                ? "border-kis-accent bg-slate-800/60"
                : "border-slate-700 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              className="mr-2 accent-yellow-400"
              checked={mode === "local"}
              onChange={() => setMode("local")}
            />
            <span className="font-medium text-slate-200">Сохранить в этом браузере</span>
            <p className="mt-1 text-xs text-slate-400">
              localStorage + обфускация (не настоящее шифрование). Удобно, но менее безопасно.
            </p>
          </label>
        </div>
      </fieldset>

      <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400">
        🔒 Серверы KIS <span className="text-slate-200">не хранят</span> ваш токен: он живёт только в
        вашем браузере и передаётся на каждый запрос. Если брокер ротировал токен — браузер
        автоматически перезапишет его новым. Отключиться можно одной кнопкой.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-kis-down">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!valid || busy}
        onClick={() => onConnect(token.trim(), mode)}
        className="mt-6 w-full rounded-lg bg-kis-accent px-4 py-2.5 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Проверяем токен…" : "Подключить и показать портфель"}
      </button>
    </div>
  );
}
