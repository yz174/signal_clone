"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { useChat } from "@/lib/store/chat";
import { useSession } from "@/lib/store/session";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const viewer = useSession((state) => state.user);
  const { conversations, threads, openConversation, loadOlder, sendMessage } = useChat();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const conversation = useMemo(
    () => conversations.find((entry) => entry.id === id),
    [conversations, id],
  );

  useEffect(() => {
    if (id) void openConversation(id);
  }, [id, openConversation]);

  if (!viewer) return null;

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-raised">
        <p className="text-sm text-faint">Loading conversation…</p>
      </div>
    );
  }

  const thread = threads[id] ?? { messages: [], hasMore: false, loading: false };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <ChatHeader
        conversation={conversation}
        viewerId={viewer.id}
        onOpenDetails={() => setDetailsOpen(true)}
      />

      <MessageList
        messages={thread.messages}
        conversation={conversation}
        viewerId={viewer.id}
        hasMore={thread.hasMore}
        loading={thread.loading}
        onLoadOlder={() => void loadOlder(id)}
      />

      <Composer onSend={(body) => sendMessage(id, body)} />

      {detailsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Conversation details"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-line bg-surface p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-body">Details</h2>
            <ul className="mt-4 space-y-2">
              {conversation.members.map((member) => (
                <li key={member.user.id} className="flex items-center justify-between text-sm">
                  <span className="text-body">{member.user.display_name}</span>
                  <span className="text-faint capitalize">{member.role}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
