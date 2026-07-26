"use client";

import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { MoreIcon, PhoneIcon, SearchIcon, VideoIcon } from "@/components/ui/Icons";
import type { Conversation } from "@/lib/api/types";
import { avatarOf, peersOf, titleOf } from "@/lib/conversation";
import { formatLastSeen } from "@/lib/format";
import { usePresence } from "@/lib/store/presence";

interface ChatHeaderProps {
  conversation: Conversation;
  viewerId: string;
  typing: boolean;
  onOpenDetails: () => void;
}

export function ChatHeader({ conversation, viewerId, typing, onOpenDetails }: ChatHeaderProps) {
  const avatar = avatarOf(conversation, viewerId);
  const peers = peersOf(conversation, viewerId);
  const online = usePresence((state) => state.online);
  const lastSeen = usePresence((state) => state.lastSeen);

  const peer = peers[0]?.user;
  const peerIsOnline = peer ? online[peer.id] : false;

  const presenceLabel = peerIsOnline
    ? "Online"
    : formatLastSeen(peer ? (lastSeen[peer.id] ?? peer.last_seen_at) : null);

  const subtitle = typing
    ? "typing…"
    : conversation.type === "group"
      ? `${conversation.members.length} members`
      : presenceLabel;

  return (
    <header className="h-header border-line bg-surface flex shrink-0 items-center gap-3 border-b px-4">
      <Link
        href="/chats"
        aria-label="Back to chats"
        className="text-muted hover:bg-hover hover:text-body -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition md:hidden"
      >
        ‹
      </Link>

      <button
        type="button"
        onClick={onOpenDetails}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar
          name={titleOf(conversation, viewerId)}
          color={avatar.color}
          imageUrl={avatar.imageUrl}
          group={avatar.group}
          size={36}
        />
        <span className="min-w-0">
          <span className="text-body block truncate text-[15px] font-medium">
            {titleOf(conversation, viewerId)}
          </span>
          <span className={`block truncate text-xs ${typing ? "text-accent" : "text-muted"}`}>
            {subtitle}
          </span>
        </span>
      </button>

      <div className="text-muted flex items-center gap-1">
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
          className="hover:bg-hover hover:text-body flex h-9 w-9 items-center justify-center rounded-full transition"
        >
          <MoreIcon size={19} />
        </button>
      </div>
    </header>
  );
}
