"use client";

import { useEffect } from "react";

import { getAccessToken } from "@/lib/api/tokens";
import type { Message } from "@/lib/api/types";
import { useChat } from "@/lib/store/chat";
import { usePresence } from "@/lib/store/presence";
import { useSession } from "@/lib/store/session";
import { notify } from "@/lib/store/toast";
import { type ServerEvent, realtime } from "@/lib/ws/client";

function handle(event: ServerEvent): void {
  const chat = useChat.getState();
  const presence = usePresence.getState();
  const payload = event.payload;

  switch (event.type) {
    case "message.created": {
      const conversationId = payload.conversation_id as string;
      const message = payload.message as Message;
      chat.applyIncomingMessage(conversationId, message);
      presence.setTyping(conversationId, message.sender_id ?? "", false);
      realtime.send({
        type: "ack.delivered",
        conversation_id: conversationId,
        seq: message.seq,
      });
      break;
    }

    case "message.reaction":
      chat.applyReaction(
        payload.conversation_id as string,
        payload.message_id as string,
        payload.user_id as string,
        (payload.emoji as string | null) ?? null,
      );
      break;

    case "message.deleted":
      chat.applyDeletedMessage(payload.conversation_id as string, payload.message_id as string);
      break;

    case "receipt.updated":
      chat.applyReceipt(
        payload.conversation_id as string,
        payload.user_id as string,
        payload.last_read_seq as number,
        payload.last_delivered_seq as number,
      );
      break;

    case "typing.updated":
      presence.setTyping(
        payload.conversation_id as string,
        payload.user_id as string,
        payload.is_typing as boolean,
      );
      break;

    case "presence.updated":
      presence.setPresence(
        payload.user_id as string,
        payload.is_online as boolean,
        (payload.last_seen_at as string | null) ?? null,
      );
      break;

    default:
      break;
  }
}

export function useRealtime(): void {
  const status = useSession((state) => state.status);

  useEffect(() => {
    if (status !== "authenticated") return;

    const token = getAccessToken();
    if (!token) return;

    const stopEvents = realtime.onEvent(handle);
    let everConnected = false;
    const stopOpen = realtime.onOpen(() => {
      if (everConnected) notify("Reconnected");
      everConnected = true;
      void useChat.getState().recoverMissedMessages();
    });

    realtime.connect(token);

    return () => {
      stopEvents();
      stopOpen();
      realtime.disconnect();
    };
  }, [status]);
}
