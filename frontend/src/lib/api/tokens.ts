const REFRESH_KEY = "signal.refresh";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function storeTokens(access: string, refresh: string): void {
  accessToken = access;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REFRESH_KEY, refresh);
  }
}

export function clearTokens(): void {
  accessToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(REFRESH_KEY);
  }
}
