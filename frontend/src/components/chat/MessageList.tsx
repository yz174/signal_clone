"use client";

import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/MessageBubble";
import type { Conversation, LocalMessage } from "@/lib/api/types";
import { formatDayDivider, isSameDay } from "@/lib/format";

const GROUPING_WINDOW_MS = 5 * 60_000;

function grouped(current: LocalMessage, neighbour: LocalMessage | undefined): boolean {
  if (!neighbour) return false;
  if (neighbour.sender_id !== current.sender_id) return false;
  if (!isSameDay(neighbour.created_at, current.created_at)) return false;
  const gap = Math.abs(
    new Date(current.created_at).getTime() - new Date(neighbour.created_at).getTime(),
  );
  return gap < GROUPING_WINDOW_MS;
}

interface MessageListProps {
  messages: LocalMessage[];
  conversation: Conversation;
  viewerId: string;
  hasMore: boolean;
  loading: boolean;
  onLoadOlder: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: LocalMessage) => void;
  onDelete: (messageId: string) => void;
  onRetry: (clientMessageId: string) => void;
}

export function MessageList({
  messages,
  conversation,
  viewerId,
  hasMore,
  loading,
  onLoadOlder,
  onReact,
  onReply,
  onDelete,
  onRetry,
}: MessageListProps) {
  const byId = new Map(messages.map((message) => [message.id, message]));
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
            className="bg-surface-sunken text-muted hover:text-body rounded-full px-4 py-1.5 text-xs font-medium transition"
          >
            Load earlier messages
          </button>
        </div>
      )}

      {messages.length === 0 && !loading && (
        <p className="text-faint py-10 text-center text-sm">No messages yet. Say hello.</p>
      )}

      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const startsNewDay = !previous || !isSameDay(previous.created_at, message.created_at);

        return (
          <div key={message.id} className="group relative py-1 hover:z-30">
            {startsNewDay && (
              <div className="my-4 flex justify-center">
                <span className="bg-surface-sunken text-muted rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
                  {formatDayDivider(message.created_at)}
                </span>
              </div>
            )}
            <MessageBubble
              message={message}
              quoted={message.reply_to_id ? byId.get(message.reply_to_id) : undefined}
              conversation={conversation}
              viewerId={viewerId}
              groupedWithPrevious={!startsNewDay && grouped(message, previous)}
              groupedWithNext={grouped(message, next)}
              onReact={(emoji) => onReact(message.id, emoji)}
              onReply={() => onReply(message)}
              onDelete={() => onDelete(message.id)}
              onRetry={() => onRetry(message.client_message_id)}
            />
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
