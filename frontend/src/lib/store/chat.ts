"use client";

import { create } from "zustand";

import { api } from "@/lib/api/client";
import type { Conversation, LocalMessage, Message } from "@/lib/api/types";

interface Thread {
  messages: LocalMessage[];
  hasMore: boolean;
  loading: boolean;
}

const EMPTY_THREAD: Thread = { messages: [], hasMore: false, loading: false };

const PENDING_SEQ = Number.MAX_SAFE_INTEGER;

interface ChatState {
  conversations: Conversation[];
  threads: Record<string, Thread>;
  loadingConversations: boolean;
  error: string | null;

  loadConversations: () => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
  loadOlder: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, body: string) => Promise<void>;
  retryMessage: (conversationId: string, clientMessageId: string) => Promise<void>;
  markRead: (conversationId: string) => Promise<void>;

  applyIncomingMessage: (conversationId: string, message: Message) => void;
  applyDeletedMessage: (conversationId: string, messageId: string) => void;
  applyReceipt: (
    conversationId: string,
    userId: string,
    lastReadSeq: number,
    lastDeliveredSeq: number,
  ) => void;
  recoverMissedMessages: () => Promise<void>;

  threadFor: (conversationId: string) => Thread;
}

function sortByActivity(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (left, right) =>
      new Date(right.last_activity_at).getTime() - new Date(left.last_activity_at).getTime(),
  );
}

function newestRealSeq(messages: LocalMessage[]): number {
  return messages.reduce(
    (highest, message) => (message.seq === PENDING_SEQ ? highest : Math.max(highest, message.seq)),
    0,
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
    if (get().threadFor(conversationId).messages.length > 0) {
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

    const optimistic: LocalMessage = {
      id: `pending:${clientMessageId}`,
      conversation_id: conversationId,
      seq: PENDING_SEQ,
      sender_id: null,
      kind: "text",
      body,
      reply_to_id: null,
      client_message_id: clientMessageId,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      expires_at: null,
      pending: true,
    };

    set((state) => {
      const current = state.threads[conversationId] ?? EMPTY_THREAD;
      return {
        threads: {
          ...state.threads,
          [conversationId]: { ...current, messages: [...current.messages, optimistic] },
        },
      };
    });

    await get().retryMessage(conversationId, clientMessageId);
  },

  retryMessage: async (conversationId, clientMessageId) => {
    const pending = get()
      .threadFor(conversationId)
      .messages.find((message) => message.client_message_id === clientMessageId);
    if (!pending?.body) return;

    set((state) => ({
      threads: {
        ...state.threads,
        [conversationId]: {
          ...(state.threads[conversationId] ?? EMPTY_THREAD),
          messages: (state.threads[conversationId] ?? EMPTY_THREAD).messages.map((message) =>
            message.client_message_id === clientMessageId
              ? { ...message, pending: true, failed: false }
              : message,
          ),
        },
      },
    }));

    try {
      const saved = await api.sendMessage(conversationId, {
        clientMessageId,
        body: pending.body,
      });
      get().applyIncomingMessage(conversationId, saved);
    } catch {
      set((state) => ({
        threads: {
          ...state.threads,
          [conversationId]: {
            ...(state.threads[conversationId] ?? EMPTY_THREAD),
            messages: (state.threads[conversationId] ?? EMPTY_THREAD).messages.map((message) =>
              message.client_message_id === clientMessageId
                ? { ...message, pending: false, failed: true }
                : message,
            ),
          },
        },
      }));
    }
  },

  applyIncomingMessage: (conversationId, message) => {
    set((state) => {
      const thread = state.threads[conversationId] ?? EMPTY_THREAD;

      const at = thread.messages.findIndex(
        (existing) =>
          existing.id === message.id ||
          existing.client_message_id === message.client_message_id,
      );

      const messages =
        at >= 0
          ? thread.messages.map((existing, index) => (index === at ? message : existing))
          : [...thread.messages, message];

      messages.sort((left, right) => left.seq - right.seq);

      const conversations = state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              last_message: message,
              last_seq: Math.max(conversation.last_seq, message.seq),
              last_activity_at: message.created_at,
            }
          : conversation,
      );

      return {
        threads: { ...state.threads, [conversationId]: { ...thread, messages } },
        conversations: sortByActivity(conversations),
      };
    });
  },

  applyDeletedMessage: (conversationId, messageId) =>
    set((state) => {
      const thread = state.threads[conversationId];
      if (!thread) return {};
      return {
        threads: {
          ...state.threads,
          [conversationId]: {
            ...thread,
            messages: thread.messages.map((message) =>
              message.id === messageId
                ? { ...message, deleted_at: new Date().toISOString(), body: null }
                : message,
            ),
          },
        },
      };
    }),

  applyReceipt: (conversationId, userId, lastReadSeq, lastDeliveredSeq) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              members: conversation.members.map((member) =>
                member.user.id === userId
                  ? {
                      ...member,
                      last_read_seq: lastReadSeq,
                      last_delivered_seq: lastDeliveredSeq,
                    }
                  : member,
              ),
            }
          : conversation,
      ),
    })),

  markRead: async (conversationId) => {
    const thread = get().threadFor(conversationId);
    const newestSeq = newestRealSeq(thread.messages);
    if (newestSeq === 0) return;

    await api.markRead(conversationId, newestSeq).catch(() => undefined);
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation,
      ),
    }));
  },

  recoverMissedMessages: async () => {
    await get().loadConversations();

    const loadedThreads = Object.entries(get().threads).filter(
      ([, thread]) => thread.messages.length > 0,
    );

    for (const [conversationId, thread] of loadedThreads) {
      const page = await api
        .listMessages(conversationId, { afterSeq: newestRealSeq(thread.messages) })
        .catch(() => null);
      if (!page) continue;
      for (const message of page.items) {
        get().applyIncomingMessage(conversationId, message);
      }
    }
  },
}));
