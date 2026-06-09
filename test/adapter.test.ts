import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWechatTextMessage } from "../src/adapter/wechat-message.js";
import type { InboundMsg } from "../src/transport/ilink-types.js";

test("normalizes real iLink text message", () => {
  const msg: InboundMsg = {
    fromUserId: "user123@im.wechat",
    toUserId: "bot456@im.bot",
    messageType: 1,
    messageState: 2,
    contextToken: "ctx-abc-123",
    itemList: [
      {
        type: 1,
        textItem: { text: "k hello world" }
      }
    ],
    raw: {}
  };

  const result = normalizeWechatTextMessage(msg);

  assert.equal(result?.senderId, "user123@im.wechat");
  assert.equal(result?.chatId, "bot456@im.bot");
  assert.equal(result?.text, "k hello world");
  assert.equal(result?.contextToken, "ctx-abc-123");
  assert.equal(result?.isGroupChat, false);
});

test("detects group chat via @im.room suffix", () => {
  const msg: InboundMsg = {
    fromUserId: "user123@im.wechat",
    toUserId: "room123@im.room",
    messageType: 1,
    messageState: 2,
    itemList: [{ type: 1, textItem: { text: "k test" } }],
    raw: {}
  };

  const result = normalizeWechatTextMessage(msg);

  assert.equal(result?.isGroupChat, true);
});

test("ignores non-text messages (message_type != 1)", () => {
  const msg: InboundMsg = {
    fromUserId: "user123@im.wechat",
    toUserId: "bot456@im.bot",
    messageType: 2, // image or other
    messageState: 2,
    itemList: [{ type: 1, textItem: { text: "k test" } }],
    raw: {}
  };

  assert.equal(normalizeWechatTextMessage(msg), null);
});

test("ignores messages with empty text", () => {
  const msg: InboundMsg = {
    fromUserId: "user123@im.wechat",
    toUserId: "bot456@im.bot",
    messageType: 1,
    messageState: 2,
    itemList: [],
    raw: {}
  };

  assert.equal(normalizeWechatTextMessage(msg), null);
});

test("concatenates multiple text items", () => {
  const msg: InboundMsg = {
    fromUserId: "user123@im.wechat",
    toUserId: "bot456@im.bot",
    messageType: 1,
    messageState: 2,
    itemList: [
      { type: 1, textItem: { text: "line one" } },
      { type: 1, textItem: { text: "line two" } }
    ],
    raw: {}
  };

  const result = normalizeWechatTextMessage(msg);

  assert.equal(result?.text, "line one\nline two");
});
