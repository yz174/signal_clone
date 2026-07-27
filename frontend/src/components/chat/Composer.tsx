"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError, api } from "@/lib/api/client";
import { measureImage } from "@/lib/image";
import { notify } from "@/lib/store/toast";

import { PlusIcon, SendIcon } from "@/components/ui/Icons";
import type { Attachment, LocalMessage } from "@/lib/api/types";

interface Draft {
  key: string;
  previewUrl: string | null;
  sizeBytes: number;
  attachment: Attachment | null;
}

interface ComposerProps {
  onSend: (body: string, attachments: Attachment[]) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  replyTo?: LocalMessage | null;
  onCancelReply?: () => void;
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => objectUrls.current.forEach(URL.revokeObjectURL), []);

  const uploading = drafts.some((entry) => entry.attachment === null);
  const canSend =
    (draft.trim().length > 0 || drafts.length > 0) && !sending && !uploading && !disabled;

  function discard(key: string) {
    setDrafts((current) => {
      const going = current.find((entry) => entry.key === key);
      if (going?.previewUrl) URL.revokeObjectURL(going.previewUrl);
      return current.filter((entry) => entry.key !== key);
    });
  }

  async function attachFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const picked = Array.from(files);
    if (filePicker.current) filePicker.current.value = "";

    for (const file of picked) {
      const key = crypto.randomUUID();
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      if (previewUrl) objectUrls.current.push(previewUrl);

      const dimensions = previewUrl ? await measureImage(previewUrl) : null;

      setDrafts((current) => [
        ...current,
        { key, previewUrl, sizeBytes: file.size, attachment: null },
      ]);

      try {
        const uploaded = await api.uploadAttachment(file, dimensions ?? undefined);
        setDrafts((current) =>
          current.map((entry) => (entry.key === key ? { ...entry, attachment: uploaded } : entry)),
        );
      } catch (caught) {
        notify(caught instanceof ApiError ? caught.message : "Upload failed", "error");
        discard(key);
      }
    }
  }

  function resize() {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }

  async function submit() {
    if (!canSend) return;
    const body = draft.trim();
    const outgoing = drafts.flatMap((entry) => (entry.attachment ? [entry.attachment] : []));
    const sent = drafts;

    setSending(true);
    setDraft("");
    setDrafts([]);
    onTyping?.(false);
    requestAnimationFrame(resize);

    try {
      await onSend(body, outgoing);
      for (const entry of sent) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
    } catch {
      setDraft(body);
      setDrafts(sent);
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

      {drafts.length > 0 && (
        <div className="border-line flex flex-wrap gap-2 border-b px-4 py-2">
          {drafts.map((entry) => {
            const pending = entry.attachment === null;
            return (
              <div key={entry.key} className="relative w-28">
                {entry.previewUrl ? (
                  <div className="bg-surface-sunken relative aspect-square overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.previewUrl}
                      alt=""
                      className={`h-full w-full object-cover transition-opacity duration-300 ease-out ${
                        pending ? "opacity-40" : "opacity-100"
                      }`}
                    />
                    {pending && (
                      <span
                        role="status"
                        aria-label="Uploading"
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <span className="border-body/25 border-t-body h-5 w-5 animate-spin rounded-full border-2" />
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    className={`border-line flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border px-2 ${
                      pending ? "animate-pulse" : ""
                    }`}
                  >
                    <span aria-hidden className="text-lg">
                      📎
                    </span>
                    <span className="text-muted text-[11px]">{readableSize(entry.sizeBytes)}</span>
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => discard(entry.key)}
                  className="bg-surface border-line absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border text-xs"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2 px-4 py-3">
        <input
          ref={filePicker}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain"
          className="hidden"
          onChange={(event) => void attachFiles(event.target.files)}
        />
        <button
          type="button"
          aria-label="Add attachment"
          onClick={() => filePicker.current?.click()}
          disabled={uploading || disabled}
          className="text-muted hover:bg-hover hover:text-body mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40"
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
