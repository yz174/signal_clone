import { initialsFor, paletteFor } from "@/lib/design/avatars";

interface AvatarProps {
  name: string;
  color?: string | null;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ name, color, imageUrl, size = 48, className = "" }: AvatarProps) {
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
      {initialsFor(name)}
    </div>
  );
}
