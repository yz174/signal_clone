"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/ui/Avatar";
import { ChatIcon, PhoneIcon, SettingsIcon, StoryIcon } from "@/components/ui/Icons";
import { useSession } from "@/lib/store/session";

const DESTINATIONS = [
  { href: "/chats", label: "Chats", Icon: ChatIcon },
  { href: "/calls", label: "Calls", Icon: PhoneIcon },
  { href: "/stories", label: "Stories", Icon: StoryIcon },
];

export function NavRail() {
  const pathname = usePathname();
  const user = useSession((state) => state.user);

  return (
    <nav
      aria-label="Primary"
      className="w-rail border-line bg-surface-raised flex shrink-0 flex-col items-center gap-1 border-r py-4 max-md:w-14"
    >
      {DESTINATIONS.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            title={label}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
              active ? "bg-selected text-body" : "text-muted hover:bg-hover hover:text-body"
            }`}
          >
            <Icon size={22} />
          </Link>
        );
      })}

      <div className="flex-1" />

      <Link
        href="/settings"
        aria-label="Settings"
        title="Settings"
        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
          pathname.startsWith("/settings")
            ? "bg-selected text-body"
            : "text-muted hover:bg-hover hover:text-body"
        }`}
      >
        <SettingsIcon size={22} />
      </Link>

      {user && (
        <Link href="/settings" aria-label="Your profile" className="mt-1">
          <Avatar
            name={user.display_name}
            color={user.avatar_color}
            imageUrl={user.avatar_url}
            size={32}
          />
        </Link>
      )}
    </nav>
  );
}
