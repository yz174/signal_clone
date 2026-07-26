"use client";

import { useRef, useState } from "react";

import { PlusIcon, SendIcon } from "@/components/ui/Icons";
import type { LocalMessage } from "@/lib/api/types";

interface ComposerProps {
  onSend: (body: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  replyTo?: LocalMessage | null;
  onCancelReply?: () => void;
}

export function Composer({
  onSend,
  onTyping,
  disabled = false,
  replyTo = null,
  onCancelReply,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const canSend = draft.trim().length > 0 && !sending && !disabled;

  function resize() {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }

  async function submit() {
    if (!canSend) return;
    const body = draft.trim();

    setSending(true);
    setDraft("");
    onTyping?.(false);
    requestAnimationFrame(resize);

    try {
      await onSend(body);
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
      textarea.current?.focus();
    }
  }

  return (
    <div className="border-line bg-surface border-t">
      {replyTo && (
        <div className="border-line flex items-start gap-2 border-b px-4 py-2">
          <span aria-hidden className="bg-accent mt-0.5 h-8 w-0.5 shrink-0 rounded" />
          <span className="min-w-0 flex-1">
            <span className="text-accent block text-xs font-medium">Replying to</span>
            <span className="text-muted line-clamp-1 block text-sm">{replyTo.body}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="text-muted hover:bg-hover hover:text-body flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 px-4 py-3">
        <button
          type="button"
          aria-label="Add attachment"
          title="Attachments are coming soon"
          disabled
          className="text-faint mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        >
          <PlusIcon size={20} />
        </button>

        <textarea
          ref={textarea}
          rows={1}
          value={draft}
          disabled={disabled}
          placeholder="Message"
          aria-label="Message"
          onChange={(event) => {
            setDraft(event.target.value);
            onTyping?.(event.target.value.length > 0);
            resize();
          }}
          onBlur={() => onTyping?.(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          className="scrollbar-slim bg-surface-sunken text-body placeholder:text-faint focus:ring-accent max-h-40 flex-1 resize-none rounded-2xl px-4 py-2.5 text-[15px] leading-snug outline-none focus:ring-1"
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Send"
          className="bg-accent mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
        >
          <SendIcon size={18} />
        </button>
      </div>
    </div>
  );
}
