"use client";

import { create } from "zustand";

import { api, ensureFreshSession } from "@/lib/api/client";
import { clearTokens, getRefreshToken, storeTokens } from "@/lib/api/tokens";
import type { Authenticated, User } from "@/lib/api/types";

type Status = "loading" | "authenticated" | "anonymous";

interface SessionState {
  status: Status;
  user: User | null;
  restore: () => Promise<void>;
  adopt: (payload: Authenticated) => void;
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: "loading",
  user: null,

  restore: async () => {
    if (!getRefreshToken()) {
      set({ status: "anonymous", user: null });
      return;
    }

    if (!(await ensureFreshSession())) {
      set({ status: "anonymous", user: null });
      return;
    }

    try {
      set({ user: await api.me(), status: "authenticated" });
    } catch {
      clearTokens();
      set({ status: "anonymous", user: null });
    }
  },

  adopt: (payload) => {
    storeTokens(payload.tokens.access_token, payload.tokens.refresh_token);
    set({ user: payload.user, status: "authenticated" });
  },

  setUser: (user) => set({ user }),

  signOut: async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await api.logout(refreshToken).catch(() => undefined);
    }
    clearTokens();
    set({ status: "anonymous", user: null });
  },
}));
