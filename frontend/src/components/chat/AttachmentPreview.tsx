import type { Attachment } from "@/lib/api/types";

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt="Attachment"
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
          className="max-h-72 w-auto max-w-full rounded-lg object-contain"
        />
      </a>
    );
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
