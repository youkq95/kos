import assert from "node:assert/strict";
import test from "node:test";
import { parseText } from "../src/capture/parser.js";

test("parses k command with trimmed content", () => {
  assert.deepEqual(parseText("  k Today I found an idea  "), {
    type: "capture",
    content: "Today I found an idea"
  });
});

test("parses Chinese capture command", () => {
  assert.deepEqual(parseText("\u8bb0 \u4eca\u5929\u60f3\u5230\u4e00\u4e2a\u70b9"), {
    type: "capture",
    content: "\u4eca\u5929\u60f3\u5230\u4e00\u4e2a\u70b9"
  });
});

test("normalizes multiline capture into one line", () => {
  assert.deepEqual(parseText("k first\nsecond\n\nthird"), {
    type: "capture",
    content: "first / second / third"
  });
});

test("reports empty capture", () => {
  assert.deepEqual(parseText("k   "), { type: "empty" });
  assert.deepEqual(parseText("\u8bb0"), { type: "empty" });
});

test("parses help", () => {
  assert.deepEqual(parseText("help"), { type: "help" });
});

test("ignores non commands", () => {
  assert.deepEqual(parseText("hello"), { type: "ignore" });
});
