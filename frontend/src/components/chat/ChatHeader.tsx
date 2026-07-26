"use client";

import { Avatar } from "@/components/ui/Avatar";
import { MoreIcon, PhoneIcon, SearchIcon, VideoIcon } from "@/components/ui/Icons";
import type { Conversation } from "@/lib/api/types";
import { avatarOf, peersOf, titleOf } from "@/lib/conversation";
import { formatLastSeen } from "@/lib/format";

interface ChatHeaderProps {
  conversation: Conversation;
  viewerId: string;
  onOpenDetails: () => void;
}

export function ChatHeader({ conversation, viewerId, onOpenDetails }: ChatHeaderProps) {
  const avatar = avatarOf(conversation, viewerId);
  const peers = peersOf(conversation, viewerId);

  const subtitle =
    conversation.type === "group"
      ? `${conversation.members.length} members`
      : formatLastSeen(peers[0]?.user.last_seen_at);

  return (
    <header className="flex h-header shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <button
        type="button"
        onClick={onOpenDetails}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar
          name={titleOf(conversation, viewerId)}
          color={avatar.color}
          imageUrl={avatar.imageUrl}
          size={36}
        />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-body">
            {titleOf(conversation, viewerId)}
          </span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>
      </button>

      <div className="flex items-center gap-1 text-muted">
        {[
          { Icon: VideoIcon, label: "Video call" },
          { Icon: PhoneIcon, label: "Voice call" },
          { Icon: SearchIcon, label: "Search in chat" },
        ].map(({ Icon, label }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={`${label} is coming soon`}
            disabled
            className="flex h-9 w-9 items-center justify-center rounded-full opacity-40"
          >
            <Icon size={19} />
          </button>
        ))}
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label="Conversation details"
          className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-hover hover:text-body"
        >
          <MoreIcon size={19} />
        </button>
      </div>
    </header>
  );
}
