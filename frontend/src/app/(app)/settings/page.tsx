"use client";

import { NavRail } from "@/components/layout/NavRail";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/store/session";
import { type Theme, useTheme } from "@/lib/theme";

const THEMES: Theme[] = ["light", "dark", "system"];

const PLACEHOLDERS = [
  { title: "Privacy", detail: "Read receipts, typing indicators, disappearing messages" },
  { title: "Notifications", detail: "Message alerts, sounds, badges" },
  { title: "Linked devices", detail: "Manage devices linked to this account" },
];

export default function SettingsPage() {
  const { user, signOut } = useSession();
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-surface flex h-full">
      <NavRail />

      <div className="scrollbar-slim bg-surface-raised flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="text-body text-xl font-semibold">Settings</h1>

          {user && (
            <section className="border-line bg-surface mt-6 flex items-center gap-4 rounded-xl border p-5">
              <Avatar
                name={user.display_name}
                color={user.avatar_color}
                imageUrl={user.avatar_url}
                size={64}
              />
              <div className="min-w-0">
                <p className="text-body truncate text-base font-medium">{user.display_name}</p>
                <p className="text-muted text-sm">{user.phone_e164}</p>
                {user.username && <p className="text-faint text-sm">@{user.username}</p>}
              </div>
            </section>
          )}

          <section className="border-line bg-surface mt-6 rounded-xl border p-5">
            <h2 className="text-body text-sm font-medium">Appearance</h2>
            <div className="mt-3 flex gap-2">
              {THEMES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTheme(option)}
                  aria-pressed={theme === option}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                    theme === option
                      ? "bg-accent text-white"
                      : "bg-surface-sunken text-muted hover:text-body"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          <section className="divide-line border-line bg-surface mt-6 divide-y rounded-xl border">
            {PLACEHOLDERS.map((entry) => (
              <div key={entry.title} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-body text-sm font-medium">{entry.title}</p>
                  <p className="text-muted mt-0.5 text-sm">{entry.detail}</p>
                </div>
                <span className="bg-surface-sunken text-muted shrink-0 rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
                  Soon
                </span>
              </div>
            ))}
          </section>

          <div className="mt-8">
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>

          <p className="text-faint mt-8 text-xs">
            Encryption is simulated in this build. Messages are stored unencrypted.
          </p>
        </div>
      </div>
    </div>
  );
}
