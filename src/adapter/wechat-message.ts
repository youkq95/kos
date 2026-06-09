import type { IncomingTextMessage } from "../capture/message.js";
import type { ILinkUpdate } from "../transport/ilink-types.js";

const TEXT_MESSAGE_TYPES = new Set(["text", "Text", "TEXT", "1"]);

export function normalizeWechatTextMessage(update: ILinkUpdate): IncomingTextMessage | null {
  const root = asRecord(update) ?? {};
  const message = firstRecord(root.message, root.msg, root.data, root.payload) ?? root;

  if (!isTextMessage(root, message)) {
    return null;
  }

  const text = firstString(
    message.text,
    message.content,
    message.message,
    root.text,
    root.content
  );

  if (!text) {
    return null;
  }

  const senderId = firstString(
    message.senderId,
    message.fromUserId,
    message.fromUserName,
    message.from,
    message.userId,
    message.wxid,
    root.senderId,
    root.fromUserId,
    root.fromUserName,
    root.from,
    root.userId,
    root.wxid
  );

  if (!senderId) {
    return null;
  }

  const chatId =
    firstString(
      message.chatId,
      message.roomId,
      message.conversationId,
      message.talker,
      root.chatId,
      root.roomId,
      root.conversationId,
      root.talker
    ) ?? senderId;

  const messageId = firstString(
    message.messageId,
    message.msgId,
    message.id,
    root.messageId,
    root.msgId,
    root.id
  );

  const contextToken = firstString(
    message.contextToken,
    message.ctxToken,
    root.contextToken,
    root.ctxToken
  );

  const normalized: IncomingTextMessage = {
    senderId,
    chatId,
    text,
    timestamp: parseTimestamp(
      firstNumber(message.timestamp, message.createTime, message.time, root.timestamp, root.createTime, root.time)
    ),
    isGroupChat: detectGroupChat(root, message, chatId),
    raw: update
  };

  if (messageId) {
    normalized.messageId = messageId;
  }

  if (contextToken) {
    normalized.contextToken = contextToken;
  }

  return normalized;
}

function isTextMessage(root: Record<string, unknown>, message: Record<string, unknown>): boolean {
  const msgType = firstString(
    message.type,
    message.msgType,
    message.messageType,
    root.type,
    root.msgType,
    root.messageType
  );

  if (!msgType) {
    return true;
  }

  return TEXT_MESSAGE_TYPES.has(msgType);
}

function detectGroupChat(
  root: Record<string, unknown>,
  message: Record<string, unknown>,
  chatId: string
): boolean {
  const explicitGroup = firstBoolean(
    message.isGroup,
    message.isGroupChat,
    root.isGroup,
    root.isGroupChat
  );

  if (explicitGroup !== undefined) {
    return explicitGroup;
  }

  if (firstString(message.roomId, root.roomId)) {
    return true;
  }

  return chatId.includes("chatroom") || chatId.startsWith("@@");
}

function parseTimestamp(value: number | undefined): Date {
  if (!value) {
    return new Date();
  }

  const millis = value < 10_000_000_000 ? value * 1000 : value;
  const date = new Date(millis);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  for (const value of values) {
    const record = asRecord(value);
    if (record) {
      return record;
    }
  }

  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}
