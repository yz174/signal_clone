"use client";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MessageActionsProps {
  outgoing: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete?: () => void;
}

export function MessageActions({ outgoing, onReact, onReply, onDelete }: MessageActionsProps) {
  return (
    <div
      role="menu"
      className={`border-line bg-surface absolute top-1/2 z-50 flex -translate-y-1/2 items-center gap-0.5 rounded-full border p-0.5 shadow-md ${
        outgoing ? "right-full mr-1" : "left-full ml-1"
      }`}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          aria-label={`React with ${emoji}`}
          className="hover:bg-hover flex h-6 w-6 items-center justify-center rounded-full text-sm transition"
        >
          {emoji}
        </button>
      ))}

      <span aria-hidden className="bg-line mx-1 h-4 w-px" />

      <button
        type="button"
        onClick={onReply}
        aria-label="Reply"
        className="text-muted hover:bg-hover hover:text-body rounded-full px-2 py-1 text-xs font-medium transition"
      >
        Reply
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete message"
          className="hover:bg-hover rounded-full px-2 py-1 text-xs font-medium text-[#be0404] transition"
        >
          Delete
        </button>
      )}
    </div>
  );
}
