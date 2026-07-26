"use client";

import { useEffect, useRef, useState } from "react";

import { MessageActions } from "@/components/chat/MessageActions";
import { ReceiptTicks } from "@/components/chat/ReceiptTicks";
import { Avatar } from "@/components/ui/Avatar";
import type { Conversation, LocalMessage } from "@/lib/api/types";
import { statusOf } from "@/lib/conversation";
import { formatClockTime } from "@/lib/format";

interface MessageBubbleProps {
  message: LocalMessage;
  quoted?: LocalMessage;
  conversation: Conversation;
  viewerId: string;
  groupedWithPrevious: boolean;
  groupedWithNext: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  onRetry: () => void;
}

function summariseReactions(message: LocalMessage): { emoji: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const reaction of message.reactions ?? []) {
    tally.set(reaction.emoji, (tally.get(reaction.emoji) ?? 0) + 1);
  }
  return [...tally.entries()].map(([emoji, count]) => ({ emoji, count }));
}

export function MessageBubble({
  message,
  quoted,
  conversation,
  viewerId,
  groupedWithPrevious,
  groupedWithNext,
  onReact,
  onReply,
  onDelete,
  onRetry,
}: MessageBubbleProps) {
  const outgoing = message.sender_id === viewerId || Boolean(message.pending);
  const status = statusOf(message, conversation, viewerId);
  const sender = conversation.members.find((member) => member.user.id === message.sender_id);
  const showSender = !outgoing && conversation.type === "group" && !groupedWithPrevious;
  const showAvatar = !outgoing && conversation.type === "group" && !groupedWithNext;
  const reactions = summariseReactions(message);
  const [menuOpen, setMenuOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && container.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }

    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const corners = [
    "rounded-bubble",
    outgoing && groupedWithPrevious ? "rounded-tr-bubble-tight" : "",
    outgoing && groupedWithNext ? "rounded-br-bubble-tight" : "",
    !outgoing && groupedWithPrevious ? "rounded-tl-bubble-tight" : "",
    !outgoing && groupedWithNext ? "rounded-bl-bubble-tight" : "",
  ].join(" ");

  return (
    <div
      className={`relative flex items-end gap-2 ${
        outgoing ? "justify-end" : "justify-start"
      } ${groupedWithNext ? "mt-0.5" : "mt-2"} ${reactions.length > 0 ? "mb-3" : ""}`}
    >
      {conversation.type === "group" && !outgoing && (
        <div className="w-7 shrink-0">
          {showAvatar && sender && (
            <Avatar
              name={sender.user.display_name}
              color={sender.user.avatar_color}
              imageUrl={sender.user.avatar_url}
              size={28}
            />
          )}
        </div>
      )}

      <div
        ref={container}
        className={`relative max-w-[min(306px,65%)] md:max-w-[370px] xl:max-w-[50vw] ${
          menuOpen ? "z-50" : ""
        }`}
      >
        {menuOpen && !message.deleted_at && (
          <MessageActions
            outgoing={outgoing}
            onReact={(emoji) => {
              onReact(emoji);
              setMenuOpen(false);
            }}
            onReply={() => {
              onReply();
              setMenuOpen(false);
            }}
            onDelete={
              message.sender_id === viewerId
                ? () => {
                    onDelete();
                    setMenuOpen(false);
                  }
                : undefined
            }
          />
        )}

        <div
          role="button"
          tabIndex={0}
          aria-label="Message actions"
          onClick={() => setMenuOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setMenuOpen((open) => !open);
            }
          }}
          className={`${corners} px-3 py-2 ${
            outgoing ? "bg-outgoing text-outgoing-text" : "bg-incoming text-incoming-text"
          } ${message.failed ? "opacity-60" : ""}`}
        >
          {showSender && sender && (
            <p className="text-accent mb-0.5 text-[13px] font-medium">{sender.user.display_name}</p>
          )}

          {quoted && (
            <div
              className={`mb-1.5 border-l-2 pl-2 text-[13px] ${
                outgoing ? "border-white/50 text-white/80" : "border-accent text-muted"
              }`}
            >
              <span className="line-clamp-2 block">
                {quoted.deleted_at ? "Deleted message" : quoted.body}
              </span>
            </div>
          )}

          {message.deleted_at ? (
            <p className="text-[15px] italic opacity-70">This message was deleted</p>
          ) : (
            <p className="text-[15px] leading-snug break-words whitespace-pre-wrap">
              {message.body}
            </p>
          )}

          <div
            className={`mt-[3px] flex items-center justify-end gap-1 text-[11px] ${
              outgoing ? "text-white/75" : "text-faint"
            }`}
          >
            <time dateTime={message.created_at}>{formatClockTime(message.created_at)}</time>
            {status && <ReceiptTicks status={status} />}
          </div>
        </div>

        {reactions.length > 0 && (
          <div className={`absolute -bottom-3 flex gap-0.5 ${outgoing ? "right-2" : "left-2"}`}>
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => onReact(reaction.emoji)}
                aria-label={`${reaction.count} reacted with ${reaction.emoji}`}
                className="border-line bg-surface flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] shadow-sm"
              >
                <span>{reaction.emoji}</span>
                {reaction.count > 1 && <span className="text-muted">{reaction.count}</span>}
              </button>
            ))}
          </div>
        )}

        {message.failed && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 block w-full text-right text-[11px] font-medium text-[#be0404]"
          >
            Failed. Tap to retry.
          </button>
        )}
      </div>
    </div>
  );
}
