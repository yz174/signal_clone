"use client";

import { useState } from "react";

import { ConversationList } from "@/components/layout/ConversationList";
import { NavRail } from "@/components/layout/NavRail";

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const [composing, setComposing] = useState(false);

  return (
    <div className="flex h-full bg-surface">
      <NavRail />
      <ConversationList onCompose={() => setComposing(true)} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>

      {composing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New chat"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setComposing(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-line bg-surface p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-body">New chat</h2>
            <p className="mt-2 text-sm text-muted">
              Starting new conversations lands in the next step.
            </p>
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="mt-5 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
