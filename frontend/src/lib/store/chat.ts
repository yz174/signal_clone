"use client";

import { create } from "zustand";

import { api } from "@/lib/api/client";
import type { Conversation, Message } from "@/lib/api/types";

interface Thread {
  messages: Message[];
  hasMore: boolean;
  loading: boolean;
}

const EMPTY_THREAD: Thread = { messages: [], hasMore: false, loading: false };

interface ChatState {
  conversations: Conversation[];
  threads: Record<string, Thread>;
  loadingConversations: boolean;
  error: string | null;

  loadConversations: () => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
  loadOlder: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, body: string) => Promise<void>;
  markRead: (conversationId: string) => Promise<void>;
  replaceConversation: (conversation: Conversation) => void;
  threadFor: (conversationId: string) => Thread;
}

function sortByActivity(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (left, right) =>
      new Date(right.last_activity_at).getTime() - new Date(left.last_activity_at).getTime(),
  );
}

export const useChat = create<ChatState>((set, get) => ({
  conversations: [],
  threads: {},
  loadingConversations: false,
  error: null,

  threadFor: (conversationId) => get().threads[conversationId] ?? EMPTY_THREAD,

  loadConversations: async () => {
    set({ loadingConversations: true, error: null });
    try {
      const page = await api.listConversations();
      set({ conversations: sortByActivity(page.items), loadingConversations: false });
    } catch {
      set({ error: "Could not load conversations", loadingConversations: false });
    }
  },

  openConversation: async (conversationId) => {
    const existing = get().threads[conversationId];
    if (existing && existing.messages.length > 0) {
      void get().markRead(conversationId);
      return;
    }

    set((state) => ({
      threads: { ...state.threads, [conversationId]: { ...EMPTY_THREAD, loading: true } },
    }));

    const page = await api.listMessages(conversationId);
    set((state) => ({
      threads: {
        ...state.threads,
        [conversationId]: { messages: page.items, hasMore: page.has_more, loading: false },
      },
    }));

    void get().markRead(conversationId);
  },

  loadOlder: async (conversationId) => {
    const thread = get().threadFor(conversationId);
    if (!thread.hasMore || thread.loading || thread.messages.length === 0) return;

    set((state) => ({
      threads: { ...state.threads, [conversationId]: { ...thread, loading: true } },
    }));

    const page = await api.listMessages(conversationId, { beforeSeq: thread.messages[0].seq });
    set((state) => ({
      threads: {
        ...state.threads,
        [conversationId]: {
          messages: [...page.items, ...thread.messages],
          hasMore: page.has_more,
          loading: false,
        },
      },
    }));
  },

  sendMessage: async (conversationId, body) => {
    const clientMessageId = crypto.randomUUID();
    const message = await api.sendMessage(conversationId, { clientMessageId, body });

    set((state) => {
      const thread = state.threads[conversationId] ?? EMPTY_THREAD;
      return {
        threads: {
          ...state.threads,
          [conversationId]: { ...thread, messages: [...thread.messages, message] },
        },
      };
    });

    const refreshed = await api.getConversation(conversationId);
    get().replaceConversation(refreshed);
  },

  markRead: async (conversationId) => {
    const thread = get().threadFor(conversationId);
    const newest = thread.messages.at(-1);
    if (!newest) return;

    await api.markRead(conversationId, newest.seq).catch(() => undefined);
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation,
      ),
    }));
  },

  replaceConversation: (conversation) =>
    set((state) => {
      const others = state.conversations.filter((entry) => entry.id !== conversation.id);
      return { conversations: sortByActivity([...others, conversation]) };
    }),
}));
