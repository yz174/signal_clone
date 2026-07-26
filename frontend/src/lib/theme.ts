"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "signal.theme";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function readStoredTheme(): Theme {
  return (window.localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
}

function resolve(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyToDocument(theme: Theme): void {
  const resolved = resolve(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onExternalChange = () => {
    applyToDocument(readStoredTheme());
    listener();
  };

  listeners.add(listener);
  media.addEventListener("change", onExternalChange);
  window.addEventListener("storage", onExternalChange);

  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onExternalChange);
    window.removeEventListener("storage", onExternalChange);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, () => "system" as Theme);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolve(readStoredTheme()),
    () => "light" as const,
  );

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    applyToDocument(next);
    notify();
  }, []);

  return { theme, resolved, setTheme };
}
