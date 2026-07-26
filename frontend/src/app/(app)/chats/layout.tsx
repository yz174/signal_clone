"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import { useShortcuts } from "@/lib/useShortcuts";

import { NewChatModal } from "@/components/modals/NewChatModal";
import { NewGroupModal } from "@/components/modals/NewGroupModal";
import { ConversationList } from "@/components/layout/ConversationList";
import { NavRail } from "@/components/layout/NavRail";

type Compose = "none" | "chat" | "group";

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string }>();
  const viewingThread = Boolean(params?.id);
  const [compose, setCompose] = useState<Compose>("none");

  useShortcuts({
    onNewChat: useCallback(() => setCompose("chat"), []),
    onSearch: useCallback(() => {
      document.querySelector<HTMLInputElement>('input[aria-label="Search chats"]')?.focus();
    }, []),
    onEscape: useCallback(() => setCompose("none"), []),
  });

  return (
    <div className="bg-surface flex h-full">
      <NavRail />
      <ConversationList onCompose={() => setCompose("chat")} hideOnMobile={viewingThread} />
      <div className={`flex min-w-0 flex-1 flex-col ${viewingThread ? "" : "max-md:hidden"}`}>
        {children}
      </div>

      {compose === "chat" && (
        <NewChatModal
          onClose={() => setCompose("none")}
          onCreateGroup={() => setCompose("group")}
        />
      )}
      {compose === "group" && <NewGroupModal onClose={() => setCompose("none")} />}
    </div>
  );
}
