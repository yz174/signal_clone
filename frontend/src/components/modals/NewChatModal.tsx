"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError, api } from "@/lib/api/client";
import type { Contact, User } from "@/lib/api/types";
import { useChat } from "@/lib/store/chat";
import { notify } from "@/lib/store/toast";

interface NewChatModalProps {
  onClose: () => void;
  onCreateGroup: () => void;
}

export function NewChatModal({ onClose, onCreateGroup }: NewChatModalProps) {
  const router = useRouter();
  const startDirect = useChat((state) => state.startDirect);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{ term: string; users: User[] }>({ term: "", users: [] });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .listContacts()
      .then(setContacts)
      .catch(() => setError("Could not load contacts"));
  }, []);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length === 0) return;

    const timer = setTimeout(() => {
      void api
        .searchUsers(needle)
        .then((users) => setSearch({ term: needle, users }))
        .catch(() => setSearch({ term: needle, users: [] }));
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  async function open(user: User) {
    setBusyId(user.id);
    setError(null);
    try {
      const conversation = await startDirect(user.id);
      onClose();
      router.push(`/chats/${conversation.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not start that chat");
    } finally {
      setBusyId(null);
    }
  }

  async function addContact(user: User) {
    try {
      const created = await api.addContact(user.id);
      setContacts((current) => [...current, created]);
      notify(`${user.display_name} added to contacts`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not add that contact");
    }
  }

  const needle = query.trim();
  const contactIds = new Set(contacts.map((entry) => entry.user.id));
  const showing = needle
    ? search.term === needle
      ? search.users
      : []
    : contacts.map((entry) => entry.user);

  return (
    <Modal title="New chat" onClose={onClose}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name, username or phone"
        aria-label="Search people"
        autoFocus
        className="bg-surface-sunken text-body placeholder:text-faint focus:ring-accent mb-4 h-10 w-full rounded-full px-4 text-sm outline-none focus:ring-1"
      />

      <Button variant="secondary" fullWidth onClick={onCreateGroup} className="mb-4">
        New group
      </Button>

      {error && <p className="mb-3 text-sm text-[#be0404]">{error}</p>}

      <p className="text-muted mb-2 text-xs font-medium tracking-wide uppercase">
        {needle ? "Search results" : "Your contacts"}
      </p>

      {showing.length === 0 ? (
        <p className="text-faint py-6 text-center text-sm">
          {needle ? "Searching…" : "No contacts yet. Search to find people."}
        </p>
      ) : (
        <ul className="space-y-1">
          {showing.map((user) => (
            <li
              key={user.id}
              className="hover:bg-hover flex items-center gap-3 rounded-lg px-2 py-2"
            >
              <Avatar
                name={user.display_name}
                color={user.avatar_color}
                imageUrl={user.avatar_url}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="text-body truncate text-sm font-medium">{user.display_name}</p>
                <p className="text-muted truncate text-xs">
                  {user.username ? `@${user.username}` : user.phone_e164}
                </p>
              </div>

              {!contactIds.has(user.id) && (
                <button
                  type="button"
                  onClick={() => void addContact(user)}
                  className="text-accent hover:bg-hover rounded-full px-3 py-1 text-xs font-medium transition"
                >
                  Add
                </button>
              )}

              <button
                type="button"
                onClick={() => void open(user)}
                disabled={busyId === user.id}
                className="bg-accent rounded-full px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {busyId === user.id ? "Opening…" : "Message"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
