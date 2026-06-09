import type { CaptureStorage } from "./storage.js";
import type { HandleResult, IncomingTextMessage } from "./message.js";
import { CAPTURED_REPLY, EMPTY_CAPTURE_REPLY, HELP_TEXT } from "./formatter.js";
import { parseText } from "./parser.js";
import type { Logger } from "../utils/logger.js";

export type HandleIncomingTextDependencies = {
  allowedSenders: Set<string>;
  storage: CaptureStorage;
  logger?: Logger;
};

export async function handleIncomingText(
  msg: IncomingTextMessage,
  deps: HandleIncomingTextDependencies
): Promise<HandleResult> {
  if (msg.isGroupChat) {
    deps.logger?.debug("ignored group chat message", { senderId: msg.senderId, chatId: msg.chatId });
    return { action: "ignore" };
  }

  if (!deps.allowedSenders.has(msg.senderId)) {
    deps.logger?.info("ignored non-whitelisted sender — add to ALLOWED_SENDERS to enable", { senderId: msg.senderId });
    return { action: "ignore" };
  }

  const command = parseText(msg.text);

  if (command.type === "ignore") {
    return { action: "ignore" };
  }

  if (command.type === "help") {
    return {
      action: "reply",
      text: HELP_TEXT
    };
  }

  if (command.type === "empty") {
    return {
      action: "reply",
      text: EMPTY_CAPTURE_REPLY
    };
  }

  await deps.storage.appendLog({
    content: command.content,
    timestamp: msg.timestamp,
    source: "wechat"
  });

  return {
    action: "reply",
    text: CAPTURED_REPLY
  };
}
