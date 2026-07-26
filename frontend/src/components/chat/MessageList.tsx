"use client";

import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/MessageBubble";
import type { Conversation, Message } from "@/lib/api/types";
import { formatDayDivider, isSameDay } from "@/lib/format";

const GROUPING_WINDOW_MS = 5 * 60_000;

function grouped(current: Message, neighbour: Message | undefined): boolean {
  if (!neighbour) return false;
  if (neighbour.sender_id !== current.sender_id) return false;
  if (!isSameDay(neighbour.created_at, current.created_at)) return false;
  const gap = Math.abs(
    new Date(current.created_at).getTime() - new Date(neighbour.created_at).getTime(),
  );
  return gap < GROUPING_WINDOW_MS;
}

interface MessageListProps {
  messages: Message[];
  conversation: Conversation;
  viewerId: string;
  hasMore: boolean;
  loading: boolean;
  onLoadOlder: () => void;
}

export function MessageList({
  messages,
  conversation,
  viewerId,
  hasMore,
  loading,
  onLoadOlder,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const newestSeq = messages.at(-1)?.seq ?? 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [newestSeq, conversation.id]);

  return (
    <div className="scrollbar-slim flex-1 overflow-y-auto px-4 py-3">
      {hasMore && (
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={onLoadOlder}
            className="rounded-full bg-surface-sunken px-4 py-1.5 text-xs font-medium text-muted transition hover:text-body"
          >
            Load earlier messages
          </button>
        </div>
      )}

      {messages.length === 0 && !loading && (
        <p className="py-10 text-center text-sm text-faint">No messages yet. Say hello.</p>
      )}

      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const startsNewDay = !previous || !isSameDay(previous.created_at, message.created_at);

        return (
          <div key={message.id}>
            {startsNewDay && (
              <div className="my-4 flex justify-center">
                <span className="rounded-full bg-surface-sunken px-3 py-1 text-[11px] font-medium tracking-wide text-muted uppercase">
                  {formatDayDivider(message.created_at)}
                </span>
              </div>
            )}
            <MessageBubble
              message={message}
              conversation={conversation}
              viewerId={viewerId}
              groupedWithPrevious={!startsNewDay && grouped(message, previous)}
              groupedWithNext={grouped(message, next)}
            />
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
