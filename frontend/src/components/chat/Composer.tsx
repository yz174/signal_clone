"use client";

import { useRef, useState } from "react";

import { PlusIcon, SendIcon } from "@/components/ui/Icons";

interface ComposerProps {
  onSend: (body: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
}

export function Composer({ onSend, onTyping, disabled = false }: ComposerProps) {
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
    <div className="flex items-end gap-2 border-t border-line bg-surface px-4 py-3">
      <button
        type="button"
        aria-label="Add attachment"
        title="Attachments are coming soon"
        disabled
        className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-faint"
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
        className="scrollbar-slim max-h-40 flex-1 resize-none rounded-2xl bg-surface-sunken px-4 py-2.5 text-[15px] leading-snug text-body outline-none placeholder:text-faint focus:ring-1 focus:ring-accent"
      />

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!canSend}
        aria-label="Send"
        className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition disabled:opacity-40"
      >
        <SendIcon size={18} />
      </button>
    </div>
  );
}
