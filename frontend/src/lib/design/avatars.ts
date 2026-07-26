interface AvatarPalette {
  background: string;
  foreground: string;
}

export const AVATAR_COLORS: Record<string, AvatarPalette> = {
  A100: { background: "#e3e3fe", foreground: "#3838f5" },
  A110: { background: "#dde7fc", foreground: "#1251d3" },
  A120: { background: "#d8e8f0", foreground: "#086da0" },
  A130: { background: "#cde4cd", foreground: "#067906" },
  A140: { background: "#eae0fd", foreground: "#661aff" },
  A150: { background: "#f5e3fe", foreground: "#9f00f0" },
  A160: { background: "#f6d8ec", foreground: "#b8057c" },
  A170: { background: "#f5d7d7", foreground: "#be0404" },
  A180: { background: "#fef5d0", foreground: "#836b01" },
  A190: { background: "#eae6d5", foreground: "#7d6f40" },
  A200: { background: "#d2d2dc", foreground: "#4f4f6d" },
  A210: { background: "#d7d7d9", foreground: "#5c5c5c" },
};

const FALLBACK = AVATAR_COLORS.A120;

export function paletteFor(token: string | null | undefined): AvatarPalette {
  return (token && AVATAR_COLORS[token]) || FALLBACK;
}

export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
