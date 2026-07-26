import type { Conversation, LocalMessage, Member, Message, MessageStatus } from "@/lib/api/types";

export function peersOf(conversation: Conversation, viewerId: string): Member[] {
  return conversation.members.filter((member) => member.user.id !== viewerId);
}

export function memberOf(conversation: Conversation, viewerId: string): Member | undefined {
  return conversation.members.find((member) => member.user.id === viewerId);
}

export function titleOf(conversation: Conversation, viewerId: string): string {
  if (conversation.type === "group") return conversation.name ?? "Group";
  const [peer] = peersOf(conversation, viewerId);
  return peer?.user.display_name ?? "Unknown";
}

export function avatarOf(
  conversation: Conversation,
  viewerId: string,
): { color: string | null; imageUrl: string | null } {
  if (conversation.type === "group") {
    return { color: "A200", imageUrl: conversation.avatar_url };
  }
  const [peer] = peersOf(conversation, viewerId);
  return { color: peer?.user.avatar_color ?? null, imageUrl: peer?.user.avatar_url ?? null };
}

export function previewOf(
  conversation: Conversation,
  viewerId: string,
  message: Message | null,
): string {
  if (!message) return "No messages yet";
  if (message.deleted_at) return "This message was deleted";

  const body = message.body ?? "Attachment";
  if (conversation.type !== "group" || message.sender_id === null) return body;

  const sender = conversation.members.find((member) => member.user.id === message.sender_id);
  const label = message.sender_id === viewerId ? "You" : sender?.user.display_name.split(" ")[0];
  return label ? `${label}: ${body}` : body;
}

export function statusOf(
  message: LocalMessage,
  conversation: Conversation,
  viewerId: string,
): MessageStatus | null {
  if (message.failed) return "failed";
  if (message.pending) return "sending";
  if (message.sender_id !== viewerId) return null;

  const peers = peersOf(conversation, viewerId);
  if (peers.length === 0) return "sent";

  if (peers.every((peer) => peer.last_read_seq >= message.seq)) return "read";
  if (peers.every((peer) => peer.last_delivered_seq >= message.seq)) return "delivered";
  return "sent";
}
