"use client";

import { useState } from "react";

import { NewChatModal } from "@/components/modals/NewChatModal";
import { NewGroupModal } from "@/components/modals/NewGroupModal";
import { ConversationList } from "@/components/layout/ConversationList";
import { NavRail } from "@/components/layout/NavRail";

type Compose = "none" | "chat" | "group";

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const [compose, setCompose] = useState<Compose>("none");

  return (
    <div className="flex h-full bg-surface">
      <NavRail />
      <ConversationList onCompose={() => setCompose("chat")} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>

      {compose === "chat" && (
        <NewChatModal onClose={() => setCompose("none")} onCreateGroup={() => setCompose("group")} />
      )}
      {compose === "group" && <NewGroupModal onClose={() => setCompose("none")} />}
    </div>
  );
}
