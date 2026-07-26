"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError, api } from "@/lib/api/client";
import type { Conversation, User } from "@/lib/api/types";
import { avatarOf, memberOf, titleOf } from "@/lib/conversation";
import { useChat } from "@/lib/store/chat";

interface ConversationDetailsProps {
  conversation: Conversation;
  viewerId: string;
  onClose: () => void;
}

export function ConversationDetails({
  conversation,
  viewerId,
  onClose,
}: ConversationDetailsProps) {
  const router = useRouter();
  const { renameGroup, addMembers, setMemberRole, removeMember } = useChat();

  const isGroup = conversation.type === "group";
  const viewerIsAdmin = memberOf(conversation, viewerId)?.role === "admin";

  const [name, setName] = useState(conversation.name ?? "");
  const [candidates, setCandidates] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const avatar = avatarOf(conversation, viewerId);

  useEffect(() => {
    if (!isGroup || !viewerIsAdmin) return;
    void api
      .listContacts()
      .then((contacts) => setCandidates(contacts.map((entry) => entry.user)))
      .catch(() => undefined);
  }, [isGroup, viewerIsAdmin]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That did not work");
    } finally {
      setBusy(false);
    }
  }

  const memberIds = new Set(conversation.members.map((member) => member.user.id));
  const addable = candidates.filter((user) => !memberIds.has(user.id));

  return (
    <Modal title={isGroup ? "Group info" : "Contact info"} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 pb-5 text-center">
        <Avatar
          name={titleOf(conversation, viewerId)}
          color={avatar.color}
          imageUrl={avatar.imageUrl}
          group={avatar.group}
          size={80}
        />
        <div>
          <p className="text-lg font-semibold text-body">{titleOf(conversation, viewerId)}</p>
          <p className="text-sm text-muted">
            {isGroup ? `${conversation.members.length} members` : "Direct message"}
          </p>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-[#be0404]">{error}</p>}

      {isGroup && viewerIsAdmin && (
        <div className="mb-5 flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Group name"
            className="h-10 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm text-body outline-none focus:border-accent"
          />
          <Button
            variant="secondary"
            disabled={busy || name.trim().length === 0 || name === conversation.name}
            onClick={() => void run(() => renameGroup(conversation.id, name.trim()))}
          >
            Rename
          </Button>
        </div>
      )}

      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Members</p>
      <ul className="space-y-1">
        {conversation.members.map((member) => {
          const isSelf = member.user.id === viewerId;
          return (
            <li key={member.user.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Avatar
                name={member.user.display_name}
                color={member.user.avatar_color}
                imageUrl={member.user.avatar_url}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-body">
                  {member.user.display_name}
                  {isSelf && <span className="text-faint"> (you)</span>}
                </p>
                <p className="text-xs text-faint capitalize">{member.role}</p>
              </div>

              {isGroup && viewerIsAdmin && !isSelf && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        setMemberRole(
                          conversation.id,
                          member.user.id,
                          member.role === "admin" ? "member" : "admin",
                        ),
                      )
                    }
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-hover"
                  >
                    {member.role === "admin" ? "Demote" : "Make admin"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => removeMember(conversation.id, member.user.id))}
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-[#be0404] transition hover:bg-hover"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isGroup && viewerIsAdmin && addable.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-xs font-medium tracking-wide text-muted uppercase">
            Add from contacts
          </p>
          <ul className="space-y-1">
            {addable.map((user) => (
              <li key={user.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <Avatar
                  name={user.display_name}
                  color={user.avatar_color}
                  imageUrl={user.avatar_url}
                  size={32}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-body">
                  {user.display_name}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => addMembers(conversation.id, [user.id]))}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {isGroup && (
        <div className="mt-6 border-t border-line pt-5">
          <Button
            variant="danger"
            fullWidth
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await removeMember(conversation.id, viewerId);
                onClose();
                router.push("/chats");
              })
            }
          >
            Leave group
          </Button>
        </div>
      )}
    </Modal>
  );
}
