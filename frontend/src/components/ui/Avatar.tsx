import { initialsFor, paletteFor } from "@/lib/design/avatars";

interface AvatarProps {
  name: string;
  color?: string | null;
  imageUrl?: string | null;
  size?: number;
  className?: string;
  group?: boolean;
}

export function Avatar({
  name,
  color,
  imageUrl,
  size = 48,
  className = "",
  group = false,
}: AvatarProps) {
  const palette = paletteFor(color);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-medium select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: palette.background,
        color: palette.foreground,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {group ? <GroupGlyph size={Math.round(size * 0.52)} /> : initialsFor(name)}
    </div>
  );
}

function GroupGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M20 19v-1.4a3.5 3.5 0 0 0-2.6-3.4" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6" />
    </svg>
  );
}
