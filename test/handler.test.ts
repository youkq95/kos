import assert from "node:assert/strict";
import test from "node:test";
import type { CaptureLogEntry } from "../src/capture/message.js";
import type { CaptureStorage } from "../src/capture/storage.js";
import { handleIncomingText } from "../src/capture/handler.js";

class MemoryStorage implements CaptureStorage {
  readonly entries: CaptureLogEntry[] = [];

  async ensureReady(): Promise<void> {}

  async appendLog(entry: CaptureLogEntry): Promise<void> {
    this.entries.push(entry);
  }
}

const allowedSenders = new Set(["wechat-user-id-1"]);

test("writes capture from whitelisted sender", async () => {
  const storage = new MemoryStorage();
  const result = await handleIncomingText(
    {
      senderId: "wechat-user-id-1",
      chatId: "wechat-user-id-1",
      text: "hello",
      timestamp: new Date("2026-06-09T08:20:31.000Z")
    },
    { allowedSenders, storage }
  );

  assert.deepEqual(result, { action: "reply", text: "已记录。" });
  assert.equal(storage.entries.length, 1);
  assert.equal(storage.entries[0]?.content, "hello");
});

test("ignores non-whitelisted sender", async () => {
  const storage = new MemoryStorage();
  const result = await handleIncomingText(
    {
      senderId: "unknown",
      chatId: "unknown",
      text: "hello",
      timestamp: new Date()
    },
    { allowedSenders, storage }
  );

  assert.deepEqual(result, { action: "ignore" });
  assert.equal(storage.entries.length, 0);
});

test("ignores group chat by default", async () => {
  const storage = new MemoryStorage();
  const result = await handleIncomingText(
    {
      senderId: "wechat-user-id-1",
      chatId: "group-chatroom",
      text: "hello",
      timestamp: new Date(),
      isGroupChat: true
    },
    { allowedSenders, storage }
  );

  assert.deepEqual(result, { action: "ignore" });
  assert.equal(storage.entries.length, 0);
});

test("replies on empty capture without writing", async () => {
  const storage = new MemoryStorage();
  const result = await handleIncomingText(
    {
      senderId: "wechat-user-id-1",
      chatId: "wechat-user-id-1",
      text: "   ",
      timestamp: new Date()
    },
    { allowedSenders, storage }
  );

  assert.deepEqual(result, { action: "reply", text: "内容为空，未记录。" });
  assert.equal(storage.entries.length, 0);
});
