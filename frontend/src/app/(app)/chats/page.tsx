"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/store/session";

export default function ChatsPage() {
  const { user, signOut } = useSession();
  if (!user) return null;

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-surface px-6">
      <Avatar name={user.display_name} color={user.avatar_color} size={72} />
      <div className="text-center">
        <p className="text-lg font-semibold text-body">{user.display_name}</p>
        <p className="text-sm text-muted">{user.phone_e164}</p>
      </div>
      <Button variant="secondary" onClick={() => void signOut()}>
        Sign out
      </Button>
    </main>
  );
}
