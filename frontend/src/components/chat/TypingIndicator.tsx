interface TypingIndicatorProps {
  names: string[];
  showNames?: boolean;
}

export function TypingIndicator({ names, showNames = false }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="mt-2 flex items-end gap-2" role="status" aria-label={label}>
      <span className="rounded-bubble bg-incoming flex items-center gap-1 px-3.5 py-3">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            aria-hidden
            className="bg-faint typing-dot h-1.5 w-1.5 rounded-full"
            style={{ animationDelay: `${dot * 160}ms` }}
          />
        ))}
      </span>
      {showNames && <span className="text-muted text-xs">{label}</span>}
    </div>
  );
}
