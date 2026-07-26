import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from "./tokens";
import type {
  Attachment,
  Authenticated,
  Contact,
  Conversation,
  ConversationPage,
  Member,
  Message,
  MessagePage,
  Receipt,
  SearchResults,
  User,
  VerifyOtpResult,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Body = Record<string, unknown> | undefined;

interface RequestOptions {
  method?: string;
  body?: Body;
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE}/api/v1${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function toApiError(response: Response): Promise<ApiError> {
  const fallback = `Request failed with ${response.status}`;
  try {
    const payload = await response.json();
    const error = payload?.error;
    return new ApiError(
      response.status,
      error?.code ?? "unknown",
      error?.message ?? fallback,
      error?.details,
    );
  } catch {
    return new ApiError(response.status, "unknown", fallback);
  }
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const token = getAccessToken();
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  return fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const response = await send("/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
    auth: false,
  });

  if (!response.ok) {
    clearTokens();
    return false;
  }

  const payload: Authenticated = await response.json();
  storeTokens(payload.tokens.access_token, payload.tokens.refresh_token);
  return true;
}

async function ensureFreshSession(): Promise<boolean> {
  refreshing ??= refreshSession().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && options.auth !== false) {
    if (await ensureFreshSession()) {
      response = await send(path, options);
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  requestOtp: (phone: string) =>
    request<{ expires_at: string }>("/auth/request-otp", {
      method: "POST",
      body: { phone_e164: phone },
      auth: false,
    }),

  verifyOtp: (phone: string, code: string) =>
    request<VerifyOtpResult>("/auth/verify-otp", {
      method: "POST",
      body: { phone_e164: phone, code },
      auth: false,
    }),

  register: (registrationToken: string, displayName: string, username?: string) =>
    request<Authenticated>("/auth/register", {
      method: "POST",
      body: {
        registration_token: registrationToken,
        display_name: displayName,
        username: username || null,
      },
      auth: false,
    }),

  logout: (refreshToken: string) =>
    request<void>("/auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
      auth: false,
    }),

  me: () => request<User>("/users/me"),

  updateMe: (changes: Partial<Pick<User, "display_name" | "username" | "about" | "avatar_url">>) =>
    request<User>("/users/me", { method: "PATCH", body: changes }),

  searchUsers: (search: string) => request<User[]>("/users", { query: { search } }),

  listContacts: () => request<Contact[]>("/contacts"),

  addContact: (userId: string, nickname?: string) =>
    request<Contact>("/contacts", {
      method: "POST",
      body: { user_id: userId, nickname: nickname ?? null },
    }),

  removeContact: (userId: string) => request<void>(`/contacts/${userId}`, { method: "DELETE" }),

  listConversations: (cursor?: string, limit = 30) =>
    request<ConversationPage>("/conversations", { query: { cursor, limit } }),

  getConversation: (id: string) => request<Conversation>(`/conversations/${id}`),

  createDirect: (userId: string) =>
    request<Conversation>("/conversations", {
      method: "POST",
      body: { type: "direct", user_id: userId },
    }),

  createGroup: (name: string, memberIds: string[], description?: string) =>
    request<Conversation>("/conversations", {
      method: "POST",
      body: {
        type: "group",
        name,
        member_ids: memberIds,
        description: description ?? null,
      },
    }),

  updateConversation: (
    id: string,
    changes: Partial<Pick<Conversation, "name" | "description" | "disappear_seconds">>,
  ) => request<Conversation>(`/conversations/${id}`, { method: "PATCH", body: changes }),

  listMembers: (id: string) => request<Member[]>(`/conversations/${id}/members`),

  addMembers: (id: string, userIds: string[]) =>
    request<Conversation>(`/conversations/${id}/members`, {
      method: "POST",
      body: { user_ids: userIds },
    }),

  setMemberRole: (id: string, memberId: string, role: Member["role"]) =>
    request<Conversation>(`/conversations/${id}/members/${memberId}`, {
      method: "PATCH",
      body: { role },
    }),

  removeMember: (id: string, memberId: string) =>
    request<void>(`/conversations/${id}/members/${memberId}`, { method: "DELETE" }),

  listMessages: (
    id: string,
    options: { beforeSeq?: number; afterSeq?: number; limit?: number } = {},
  ) =>
    request<MessagePage>(`/conversations/${id}/messages`, {
      query: {
        before_seq: options.beforeSeq,
        after_seq: options.afterSeq,
        limit: options.limit ?? 50,
      },
    }),

  sendMessage: (
    id: string,
    payload: {
      clientMessageId: string;
      body: string;
      replyToId?: string;
      attachmentIds?: string[];
    },
  ) =>
    request<Message>(`/conversations/${id}/messages`, {
      method: "POST",
      body: {
        client_message_id: payload.clientMessageId,
        body: payload.body,
        reply_to_id: payload.replyToId ?? null,
        attachment_ids: payload.attachmentIds ?? [],
      },
    }),

  uploadAttachment: async (file: File, dimensions?: { width: number; height: number }) => {
    const form = new FormData();
    form.append("file", file);
    if (dimensions) {
      form.append("width", String(dimensions.width));
      form.append("height", String(dimensions.height));
    }

    const token = getAccessToken();
    const response = await fetch(`${API_BASE}/api/v1/attachments`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });

    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as Attachment;
  },

  deleteMessage: (messageId: string) =>
    request<Message>(`/messages/${messageId}`, { method: "DELETE" }),

  setReaction: (messageId: string, emoji: string) =>
    request<Message>(`/messages/${messageId}/reaction`, { method: "PUT", body: { emoji } }),

  clearReaction: (messageId: string) =>
    request<Message>(`/messages/${messageId}/reaction`, { method: "DELETE" }),

  search: (term: string) => request<SearchResults>("/search", { query: { q: term } }),

  markRead: (id: string, seq: number) =>
    request<Receipt>(`/conversations/${id}/read`, { method: "POST", body: { seq } }),
};

export { ensureFreshSession };
