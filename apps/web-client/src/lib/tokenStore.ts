/**
 * Хранилище refresh-токена брокера — ТОЛЬКО на стороне браузера (решение MVP).
 * Серверы KIS не сохраняют токены пользователя.
 *
 * Режимы:
 *  - "session" (по умолчанию): sessionStorage — токен живёт до закрытия вкладки;
 *  - "local": localStorage + простая обфускация (XOR+base64).
 *
 * Честно предупреждаем пользователя (см. ConnectScreen): обфускация в localStorage
 * — НЕ шифрование с ключом, это защита лишь от «глазами соседа». Любой XSS может
 * прочитать токен — поэтому режим session безопаснее на чужих машинах.
 */

const KEY = "kis.bcs.refreshToken";
const MODE_KEY = "kis.tokenStorageMode";
const OBFUSCATION_SECRET = "kis-mvp-obfuscation-v1";

export type StorageMode = "session" | "local";

function xorBase64Encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  const key = new TextEncoder().encode(OBFUSCATION_SECRET);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
  let bin = "";
  out.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function xorBase64Decode(s: string): string {
  const bin = atob(s);
  const key = new TextEncoder().encode(OBFUSCATION_SECRET);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) ^ key[i % key.length];
  return new TextDecoder().decode(out);
}

function storageFor(mode: StorageMode): Storage {
  return mode === "local" ? localStorage : sessionStorage;
}

export function getMode(): StorageMode {
  return localStorage.getItem(MODE_KEY) === "local" ? "local" : "session";
}

export function setMode(mode: StorageMode): void {
  // переносим токен при смене режима
  const prev = loadToken();
  localStorage.setItem(MODE_KEY, mode);
  if (prev) saveToken(prev);
}

export function saveToken(token: string): void {
  const mode = getMode();
  const value = mode === "local" ? xorBase64Encode(token) : token;
  storageFor(mode).setItem(KEY, value);
  // чистим хранилище другого режима
  const other = mode === "local" ? sessionStorage : localStorage;
  other.removeItem(KEY);
}

export function loadToken(): string | null {
  const mode = getMode();
  const raw = storageFor(mode).getItem(KEY);
  if (!raw) return null;
  if (mode === "local") {
    try {
      return xorBase64Decode(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

export function clearToken(): void {
  sessionStorage.removeItem(KEY);
  localStorage.removeItem(KEY);
}
