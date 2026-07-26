const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatListTimestamp(iso: string): string {
  const date = new Date(iso);
  const daysApart = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);

  if (daysApart === 0) return formatClockTime(iso);
  if (daysApart === 1) return "Yesterday";
  if (daysApart < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
}

export function formatDayDivider(iso: string): string {
  const date = new Date(iso);
  const daysApart = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);

  if (daysApart === 0) return "Today";
  if (daysApart === 1) return "Yesterday";
  if (daysApart < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Offline";

  const elapsed = Date.now() - new Date(iso).getTime();
  if (elapsed < 2 * MINUTE) return "Active now";
  if (elapsed < HOUR) return `Active ${Math.round(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `Active ${Math.round(elapsed / HOUR)}h ago`;
  return `Last seen ${formatListTimestamp(iso)}`;
}

export function isSameDay(first: string, second: string): boolean {
  return startOfDay(new Date(first)) === startOfDay(new Date(second));
}
