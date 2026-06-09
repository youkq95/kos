import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_CAPTURE_REPLY, formatMarkdownLogEntry, HELP_TEXT } from "../src/capture/formatter.js";

test("formats log entry in configured timezone", () => {
  const result = formatMarkdownLogEntry(
    {
      content: "hello",
      timestamp: new Date("2026-06-09T08:20:31.000Z"),
      source: "wechat"
    },
    "Asia/Shanghai"
  );

  assert.equal(result, "\n- 2026-06-09 16:20:31 [wechat]: hello\n");
});

test("formats multiline content as one markdown list item", () => {
  const result = formatMarkdownLogEntry(
    {
      content: "first / second / third",
      timestamp: new Date("2026-06-09T08:20:31.000Z"),
      source: "wechat"
    },
    "UTC"
  );

  assert.equal(result, "\n- 2026-06-09 08:20:31 [wechat]: first / second / third\n");
});

test("help text includes all V1 commands", () => {
  assert.match(HELP_TEXT, /k/);
  assert.match(HELP_TEXT, /\u8bb0/);
  assert.match(HELP_TEXT, /help/);
});

test("empty capture reply is explicit", () => {
  assert.equal(EMPTY_CAPTURE_REPLY, "\u5185\u5bb9\u4e3a\u7a7a\uff0c\u672a\u8bb0\u5f55\u3002");
});
