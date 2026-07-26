"use client";

import { useEffect } from "react";

interface Shortcuts {
  onSearch?: () => void;
  onNewChat?: () => void;
  onEscape?: () => void;
}

export function useShortcuts({ onSearch, onNewChat, onEscape }: Shortcuts): void {
  useEffect(() => {
    function handle(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;

      if (event.key === "Escape") {
        onEscape?.();
        return;
      }

      if (!modifier) return;

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        onSearch?.();
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        onNewChat?.();
      }
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onSearch, onNewChat, onEscape]);
}
