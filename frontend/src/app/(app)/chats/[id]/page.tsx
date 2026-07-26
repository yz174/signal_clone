"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ConversationDetails } from "@/components/modals/ConversationDetails";
import { useChat } from "@/lib/store/chat";
import { usePresence } from "@/lib/store/presence";
import { useSession } from "@/lib/store/session";
import { realtime } from "@/lib/ws/client";

const TYPING_THROTTLE_MS = 3000;

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const viewer = useSession((state) => state.user);
  const { conversations, threads, openConversation, loadOlder, sendMessage, markRead } = useChat();
  const typing = usePresence((state) => state.typing);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lastTypingSentAt = useRef(0);

  const conversation = useMemo(
    () => conversations.find((entry) => entry.id === id),
    [conversations, id],
  );

  useEffect(() => {
    if (id) void openConversation(id);
  }, [id, openConversation]);

  const thread = threads[id];
  const newestSeq = thread?.messages.at(-1)?.seq ?? 0;

  useEffect(() => {
    if (id && newestSeq > 0 && document.hasFocus()) void markRead(id);
  }, [id, newestSeq, markRead]);

  const typistNames = useMemo(() => {
    if (!conversation || !viewer) return [];
    return (typing[id] ?? [])
      .filter((userId) => userId !== viewer.id)
      .map(
        (userId) =>
          conversation.members.find((member) => member.user.id === userId)?.user.display_name ??
          "Someone",
      );
  }, [conversation, id, typing, viewer]);

  function announceTyping(isTyping: boolean) {
    const now = Date.now();
    if (isTyping && now - lastTypingSentAt.current < TYPING_THROTTLE_MS) return;
    lastTypingSentAt.current = isTyping ? now : 0;
    realtime.send({ type: "typing", conversation_id: id, is_typing: isTyping });
  }

  if (!viewer) return null;

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-raised">
        <p className="text-sm text-faint">Loading conversation…</p>
      </div>
    );
  }

  const current = thread ?? { messages: [], hasMore: false, loading: false };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <ChatHeader
        conversation={conversation}
        viewerId={viewer.id}
        typing={typistNames.length > 0}
        onOpenDetails={() => setDetailsOpen(true)}
      />

      <MessageList
        messages={current.messages}
        conversation={conversation}
        viewerId={viewer.id}
        hasMore={current.hasMore}
        loading={current.loading}
        onLoadOlder={() => void loadOlder(id)}
      />

      <TypingIndicator names={typistNames} />

      <Composer onSend={(body) => sendMessage(id, body)} onTyping={announceTyping} />

      {detailsOpen && (
        <ConversationDetails
          conversation={conversation}
          viewerId={viewer.id}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  );
}
