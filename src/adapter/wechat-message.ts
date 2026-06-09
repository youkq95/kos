import type { IncomingTextMessage } from "../capture/message.js";
import type { InboundMsg } from "../transport/ilink-types.js";

const TEXT_MESSAGE_TYPE = 1;

export function normalizeWechatTextMessage(msg: InboundMsg): IncomingTextMessage | null {
  // Must be a text message (message_type = 1)
  if (msg.messageType !== TEXT_MESSAGE_TYPE) {
    return null;
  }

  // Extract text from item_list[].text_item.text
  const text = msg.itemList
    .filter((item) => item.type === 1 && item.textItem)
    .map((item) => item.textItem!.text)
    .join("\n")
    .trim();

  if (!text) {
    return null;
  }

  // Detect group chat: to_user_id contains "@im.room" or starts with "@@"
  const isGroupChat =
    msg.toUserId?.includes("@im.room") ||
    msg.toUserId?.startsWith("@@") ||
    false;

  const normalized: IncomingTextMessage = {
    senderId: msg.fromUserId,
    chatId: msg.toUserId,
    text,
    timestamp: new Date(),
    isGroupChat,
    raw: msg
  };

  if (msg.contextToken) {
    normalized.contextToken = msg.contextToken;
  }

  return normalized;
}
