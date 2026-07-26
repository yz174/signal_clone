"use client";

import { create } from "zustand";

const TYPING_TTL_MS = 6000;

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface PresenceState {
  online: Record<string, boolean>;
  lastSeen: Record<string, string | null>;
  typing: Record<string, string[]>;

  setPresence: (userId: string, isOnline: boolean, lastSeenAt: string | null) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
}

export const usePresence = create<PresenceState>((set, get) => ({
  online: {},
  lastSeen: {},
  typing: {},

  setPresence: (userId, isOnline, lastSeenAt) =>
    set((state) => ({
      online: { ...state.online, [userId]: isOnline },
      lastSeen: { ...state.lastSeen, [userId]: lastSeenAt },
    })),

  setTyping: (conversationId, userId, isTyping) => {
    const key = `${conversationId}:${userId}`;
    const existing = expiryTimers.get(key);
    if (existing) clearTimeout(existing);
    expiryTimers.delete(key);

    if (isTyping) {
      expiryTimers.set(
        key,
        setTimeout(() => get().setTyping(conversationId, userId, false), TYPING_TTL_MS),
      );
    }

    set((state) => {
      const others = (state.typing[conversationId] ?? []).filter((entry) => entry !== userId);
      const next = isTyping ? [...others, userId] : others;
      return { typing: { ...state.typing, [conversationId]: next } };
    });
  },
}));
