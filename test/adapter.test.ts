import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWechatTextMessage } from "../src/adapter/wechat-message.js";

test("normalizes nested text message", () => {
  const message = normalizeWechatTextMessage({
    message: {
      msgId: "m1",
      fromUserId: "wechat-user-id-1",
      chatId: "wechat-user-id-1",
      content: "k test",
      createTime: 1781002801,
      contextToken: "ctx-1",
      msgType: "text"
    }
  });

  assert.equal(message?.messageId, "m1");
  assert.equal(message?.senderId, "wechat-user-id-1");
  assert.equal(message?.chatId, "wechat-user-id-1");
  assert.equal(message?.text, "k test");
  assert.equal(message?.contextToken, "ctx-1");
  assert.equal(message?.isGroupChat, false);
});

test("detects obvious group chat marker", () => {
  const message = normalizeWechatTextMessage({
    fromUserId: "wechat-user-id-1",
    roomId: "group-chatroom",
    content: "k test"
  });

  assert.equal(message?.isGroupChat, true);
});

test("ignores non-text messages", () => {
  assert.equal(
    normalizeWechatTextMessage({
      fromUserId: "wechat-user-id-1",
      content: "k test",
      type: "image"
    }),
    null
  );
});
