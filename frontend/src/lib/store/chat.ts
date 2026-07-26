"use client";

import { create } from "zustand";

import { api } from "@/lib/api/client";
import type { Attachment, Conversation, LocalMessage, MemberRole, Message } from "@/lib/api/types";
import { dequeue, enqueue, queued } from "@/lib/offline/outbox";
import { notify } from "@/lib/store/toast";

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
  viewerId: string | null;
  setViewerId: (viewerId: string) => void;

  loadConversations: () => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
  loadOlder: (conversationId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    body: string,
    replyToId?: string,
    attachments?: Attachment[],
  ) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  retryMessage: (conversationId: string, clientMessageId: string) => Promise<void>;
  markRead: (conversationId: string) => Promise<void>;

  startDirect: (userId: string) => Promise<Conversation>;
  startGroup: (name: string, memberIds: string[]) => Promise<Conversation>;
  renameGroup: (conversationId: string, name: string) => Promise<void>;
  addMembers: (conversationId: string, userIds: string[]) => Promise<void>;
  setMemberRole: (conversationId: string, memberId: string, role: MemberRole) => Promise<void>;
  removeMember: (conversationId: string, memberId: string) => Promise<void>;
  forgetConversation: (conversationId: string) => void;

  applyIncomingMessage: (conversationId: string, message: Message) => void;
  applyDeletedMessage: (conversationId: string, messageId: string) => void;
  toggleReaction: (conversationId: string, messageId: string, emoji: string) => Promise<void>;
  applyReaction: (
    conversationId: string,
    messageId: string,
    userId: string,
    emoji: string | null,
  ) => void;
  applyReceipt: (
    conversationId: string,
    userId: string,
    lastReadSeq: number,
    lastDeliveredSeq: number,
  ) => void;
  recoverMissedMessages: () => Promise<void>;
  flushOutbox: () => Promise<void>;
  upsertConversation: (conversation: Conversation) => void;

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
  viewerId: null,
  setViewerId: (viewerId) => set({ viewerId }),

  threadFor: (conversationId) => get().threads[conversationId] ?? EMPTY_THREAD,

  loadConversations: async () => {
    set({ loadingConversations: true, error: null });
    try {
      const page = await api.listConversations();
      set({ conversations: sortByActivity(page.items), loadingConversations: false });
    } catch {
      set({ error: "Could not load conversations", loadingConversations: false });
      notify("Could not load your chats", "error");
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

  sendMessage: async (conversationId, body, replyToId, pendingAttachments) => {
    const clientMessageId = crypto.randomUUID();

    const optimistic: LocalMessage = {
      id: `pending:${clientMessageId}`,
      conversation_id: conversationId,
      seq: PENDING_SEQ,
      sender_id: null,
      kind: "text",
      body,
      reply_to_id: replyToId ?? null,
      client_message_id: clientMessageId,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      expires_at: null,
      reactions: [],
      attachments: pendingAttachments ?? [],
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

    await enqueue({
      clientMessageId,
      conversationId,
      body,
      replyToId,
      attachmentIds: (pendingAttachments ?? []).map((attachment) => attachment.id),
      queuedAt: new Date().toISOString(),
    });

    await get().retryMessage(conversationId, clientMessageId);
  },

  retryMessage: async (conversationId, clientMessageId) => {
    const pending = get()
      .threadFor(conversationId)
      .messages.find((message) => message.client_message_id === clientMessageId);
    if (!pending) return;

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
        body: pending.body ?? "",
        replyToId: pending.reply_to_id ?? undefined,
        attachmentIds: pending.attachments.map((attachment) => attachment.id),
      });
      get().applyIncomingMessage(conversationId, saved);
      await dequeue(clientMessageId);
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
      notify("Message failed to send. Tap it to retry.", "error");
    }
  },

  startDirect: async (userId) => {
    const conversation = await api.createDirect(userId);
    get().upsertConversation(conversation);
    return conversation;
  },

  startGroup: async (name, memberIds) => {
    const conversation = await api.createGroup(name, memberIds);
    get().upsertConversation(conversation);
    return conversation;
  },

  renameGroup: async (conversationId, name) => {
    get().upsertConversation(await api.updateConversation(conversationId, { name }));
  },

  addMembers: async (conversationId, userIds) => {
    get().upsertConversation(await api.addMembers(conversationId, userIds));
  },

  setMemberRole: async (conversationId, memberId, role) => {
    get().upsertConversation(await api.setMemberRole(conversationId, memberId, role));
  },

  removeMember: async (conversationId, memberId) => {
    await api.removeMember(conversationId, memberId);
    const refreshed = await api.getConversation(conversationId).catch(() => null);
    if (refreshed) {
      get().upsertConversation(refreshed);
    } else {
      get().forgetConversation(conversationId);
    }
  },

  forgetConversation: (conversationId) =>
    set((state) => {
      const threads = { ...state.threads };
      delete threads[conversationId];
      return {
        threads,
        conversations: state.conversations.filter((entry) => entry.id !== conversationId),
      };
    }),

  upsertConversation: (conversation) =>
    set((state) => ({
      conversations: sortByActivity([
        ...state.conversations.filter((entry) => entry.id !== conversation.id),
        conversation,
      ]),
    })),

  applyIncomingMessage: (conversationId, message) => {
    set((state) => {
      const thread = state.threads[conversationId] ?? EMPTY_THREAD;

      const at = thread.messages.findIndex(
        (existing) =>
          existing.id === message.id || existing.client_message_id === message.client_message_id,
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

  toggleReaction: async (conversationId, messageId, emoji) => {
    const thread = get().threadFor(conversationId);
    const message = thread.messages.find((entry) => entry.id === messageId);
    const mine = message?.reactions?.find((entry) => entry.user_id === get().viewerId);

    const updated =
      mine?.emoji === emoji
        ? await api.clearReaction(messageId)
        : await api.setReaction(messageId, emoji);

    get().applyIncomingMessage(conversationId, updated);
  },

  applyReaction: (conversationId, messageId, userId, emoji) =>
    set((state) => {
      const thread = state.threads[conversationId];
      if (!thread) return {};
      return {
        threads: {
          ...state.threads,
          [conversationId]: {
            ...thread,
            messages: thread.messages.map((message) => {
              if (message.id !== messageId) return message;
              const others = (message.reactions ?? []).filter((entry) => entry.user_id !== userId);
              return {
                ...message,
                reactions: emoji ? [...others, { user_id: userId, emoji }] : others,
              };
            }),
          },
        },
      };
    }),

  deleteMessage: async (conversationId, messageId) => {
    const deleted = await api.deleteMessage(messageId);
    get().applyIncomingMessage(conversationId, deleted);
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

  flushOutbox: async () => {
    const pending = await queued().catch(() => []);

    for (const message of pending) {
      const thread = get().threadFor(message.conversationId);
      const stillPending = thread.messages.some(
        (entry) => entry.client_message_id === message.clientMessageId,
      );

      if (stillPending) {
        await get().retryMessage(message.conversationId, message.clientMessageId);
        continue;
      }

      try {
        const saved = await api.sendMessage(message.conversationId, {
          clientMessageId: message.clientMessageId,
          body: message.body,
          replyToId: message.replyToId,
          attachmentIds: message.attachmentIds,
        });
        get().applyIncomingMessage(message.conversationId, saved);
        await dequeue(message.clientMessageId);
      } catch {
        break;
      }
    }
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
