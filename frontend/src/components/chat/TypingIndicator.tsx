export function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="flex items-center gap-2 px-4 pb-2" aria-live="polite">
      <span className="rounded-bubble bg-incoming flex items-center gap-1 px-3 py-2">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="bg-faint h-1.5 w-1.5 animate-bounce rounded-full"
            style={{ animationDelay: `${dot * 120}ms` }}
          />
        ))}
      </span>
      <span className="text-muted text-xs">{label}</span>
    </div>
  );
}
