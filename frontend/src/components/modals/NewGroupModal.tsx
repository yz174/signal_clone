"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { ApiError, api } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { useChat } from "@/lib/store/chat";

export function NewGroupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const startGroup = useChat((state) => state.startGroup);

  const [name, setName] = useState("");
  const [candidates, setCandidates] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .listContacts()
      .then((contacts) => setCandidates(contacts.map((entry) => entry.user)))
      .catch(() => setError("Could not load contacts"));
  }, []);

  function toggle(user: User) {
    setSelected((current) =>
      current.some((entry) => entry.id === user.id)
        ? current.filter((entry) => entry.id !== user.id)
        : [...current, user],
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const conversation = await startGroup(
        name.trim(),
        selected.map((entry) => entry.id),
      );
      onClose();
      router.push(`/chats/${conversation.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not create that group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New group"
      onClose={onClose}
      footer={
        <Button
          fullWidth
          onClick={() => void create()}
          disabled={busy || name.trim().length === 0 || selected.length === 0}
        >
          {busy ? "Creating…" : `Create group${selected.length ? ` (${selected.length})` : ""}`}
        </Button>
      }
    >
      <TextField
        label="Group name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Weekend plans"
        autoFocus
        error={error}
      />

      <p className="mt-5 mb-2 text-xs font-medium tracking-wide text-muted uppercase">
        Members ({selected.length} selected)
      </p>

      {candidates.length === 0 ? (
        <p className="py-6 text-center text-sm text-faint">
          Add some contacts first, then you can group them.
        </p>
      ) : (
        <ul className="space-y-1">
          {candidates.map((user) => {
            const chosen = selected.some((entry) => entry.id === user.id);
            return (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => toggle(user)}
                  aria-pressed={chosen}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-hover"
                >
                  <Avatar
                    name={user.display_name}
                    color={user.avatar_color}
                    imageUrl={user.avatar_url}
                    size={40}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-body">
                      {user.display_name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {user.username ? `@${user.username}` : user.phone_e164}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                      chosen ? "border-accent bg-accent text-white" : "border-line-strong"
                    }`}
                  >
                    {chosen ? "✓" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
