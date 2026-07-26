"use client";

import { ReceiptTicks } from "@/components/chat/ReceiptTicks";
import { Avatar } from "@/components/ui/Avatar";
import type { Conversation, Message } from "@/lib/api/types";
import { statusOf } from "@/lib/conversation";
import { formatClockTime } from "@/lib/format";

interface MessageBubbleProps {
  message: Message;
  conversation: Conversation;
  viewerId: string;
  groupedWithPrevious: boolean;
  groupedWithNext: boolean;
}

export function MessageBubble({
  message,
  conversation,
  viewerId,
  groupedWithPrevious,
  groupedWithNext,
}: MessageBubbleProps) {
  const outgoing = message.sender_id === viewerId;
  const status = statusOf(message, conversation, viewerId);
  const sender = conversation.members.find((member) => member.user.id === message.sender_id);
  const showSender = !outgoing && conversation.type === "group" && !groupedWithPrevious;
  const showAvatar = !outgoing && conversation.type === "group" && !groupedWithNext;

  const corners = [
    "rounded-bubble",
    outgoing && groupedWithPrevious ? "rounded-tr-bubble-tight" : "",
    outgoing && groupedWithNext ? "rounded-br-bubble-tight" : "",
    !outgoing && groupedWithPrevious ? "rounded-tl-bubble-tight" : "",
    !outgoing && groupedWithNext ? "rounded-bl-bubble-tight" : "",
  ].join(" ");

  return (
    <div
      className={`flex items-end gap-2 ${outgoing ? "justify-end" : "justify-start"} ${
        groupedWithNext ? "mt-0.5" : "mt-2"
      }`}
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
        className={`${corners} max-w-[min(306px,65%)] px-3 py-2 md:max-w-[370px] xl:max-w-[50vw] ${
          outgoing ? "bg-outgoing text-outgoing-text" : "bg-incoming text-incoming-text"
        }`}
      >
        {showSender && sender && (
          <p className="mb-0.5 text-[13px] font-medium text-accent">
            {sender.user.display_name}
          </p>
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
    </div>
  );
}
