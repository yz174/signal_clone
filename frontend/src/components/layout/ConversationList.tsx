"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ConversationRow } from "@/components/layout/ConversationRow";
import { SearchResults } from "@/components/layout/SearchResults";
import { ComposeIcon, SearchIcon } from "@/components/ui/Icons";
import { api } from "@/lib/api/client";
import type { SearchResults as Results } from "@/lib/api/types";
import { previewOf, titleOf } from "@/lib/conversation";
import { useChat } from "@/lib/store/chat";
import { useSession } from "@/lib/store/session";

type Filter = "all" | "unread";

export function ConversationList({ onCompose }: { onCompose: () => void }) {
  const params = useParams<{ id?: string }>();
  const viewer = useSession((state) => state.user);
  const { conversations, loadingConversations, loadConversations } = useChat();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [remote, setRemote] = useState<{ term: string; results: Results } | null>(null);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) return;

    const timer = setTimeout(() => {
      void api
        .search(needle)
        .then((results) => setRemote({ term: needle, results }))
        .catch(() => undefined);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const needle = query.trim();

  const visible = useMemo(() => {
    if (!viewer) return [];
    const lowered = query.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (filter === "unread" && conversation.unread_count === 0) return false;
      if (!lowered) return true;

      const haystack = [
        titleOf(conversation, viewer.id),
        previewOf(conversation, viewer.id, conversation.last_message),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(lowered);
    });
  }, [conversations, filter, query, viewer]);

  if (!viewer) return null;

  return (
    <aside className="flex w-list shrink-0 flex-col border-r border-line bg-surface">
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-body">Chats</h1>
          <button
            type="button"
            onClick={onCompose}
            aria-label="New chat"
            title="New chat"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-body"
          >
            <ComposeIcon size={19} />
          </button>
        </div>

        <div className="relative mt-3">
          <SearchIcon
            size={17}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search chats"
            className="h-9 w-full rounded-full bg-surface-sunken pr-3 pl-9 text-sm text-body outline-none placeholder:text-faint focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="mt-3 flex gap-2">
          {(["all", "unread"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              aria-pressed={filter === option}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                filter === option
                  ? "bg-accent text-white"
                  : "bg-surface-sunken text-muted hover:text-body"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      <div className="scrollbar-slim flex-1 overflow-y-auto pb-3">
        {needle.length >= 2 && remote?.term === needle ? (
          <SearchResults results={remote.results} onNavigate={() => setQuery("")} />
        ) : loadingConversations && conversations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-faint">Loading chats…</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-faint">
            {query ? "No chats match that search." : "No chats yet."}
          </p>
        ) : (
          visible.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              viewerId={viewer.id}
              active={params?.id === conversation.id}
            />
          ))
        )}
      </div>
    </aside>
  );
}
