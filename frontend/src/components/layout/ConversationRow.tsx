"use client";

import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import type { Conversation, Message } from "@/lib/api/types";
import { avatarOf, previewOf, titleOf } from "@/lib/conversation";
import { formatListTimestamp } from "@/lib/format";

interface ConversationRowProps {
  conversation: Conversation;
  viewerId: string;
  active: boolean;
}

export function ConversationRow({ conversation, viewerId, active }: ConversationRowProps) {
  const avatar = avatarOf(conversation, viewerId);
  const lastMessage = conversation.last_message as Message | null;
  const unread = conversation.unread_count;

  return (
    <Link
      href={`/chats/${conversation.id}`}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 px-4 py-2.5 transition ${
        active ? "bg-selected" : "hover:bg-hover"
      }`}
    >
      <Avatar
        name={titleOf(conversation, viewerId)}
        color={avatar.color}
        imageUrl={avatar.imageUrl}
        size={48}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-medium text-body">
            {titleOf(conversation, viewerId)}
          </span>
          <span
            className={`shrink-0 text-xs ${unread > 0 ? "font-medium text-accent" : "text-faint"}`}
          >
            {formatListTimestamp(conversation.last_activity_at)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm ${unread > 0 ? "text-body" : "text-muted"}`}
          >
            {previewOf(conversation, viewerId, lastMessage)}
          </span>
          {unread > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
