"use client";

import { useState } from "react";

import type { Attachment } from "@/lib/api/types";

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageAttachment({ attachment }: { attachment: Attachment }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  if (state === "failed") {
    return (
      <div className="border-line text-muted mt-1 flex h-24 w-40 items-center justify-center rounded-lg border text-xs">
        Image unavailable
      </div>
    );
  }

  const ratio = attachment.width && attachment.height ? attachment.width / attachment.height : null;
  const known = ratio !== null;

  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-1 block">
      <div
        className="bg-surface-sunken relative w-full overflow-hidden rounded-lg"
        style={{
          ...(known ? { aspectRatio: String(ratio) } : {}),
          ...(!known && state === "loading" ? { height: "9rem" } : {}),
        }}
      >
        {state === "loading" && (
          <span aria-hidden className="bg-surface-sunken absolute inset-0 animate-pulse" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt="Attachment"
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          className={`relative transition-opacity duration-300 ease-out ${
            known ? "h-full w-full object-cover" : "h-auto w-full"
          } ${state === "ready" ? "opacity-100" : "opacity-0"}`}
        />
      </div>
    </a>
  );
}

export function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === "image") {
    return <ImageAttachment attachment={attachment} />;
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="border-line mt-1 flex items-center gap-2 rounded-lg border px-3 py-2"
    >
      <span aria-hidden className="text-lg">
        📎
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">Attachment</span>
        <span className="block text-xs opacity-70">{readableSize(attachment.size_bytes)}</span>
      </span>
    </a>
  );
}
