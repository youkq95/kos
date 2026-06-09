import assert from "node:assert/strict";
import test from "node:test";
import { parseText } from "../src/capture/parser.js";

test("captures any non-empty message", () => {
  assert.deepEqual(parseText("Today I found an idea"), {
    type: "capture",
    content: "Today I found an idea"
  });
});

test("captures Chinese message", () => {
  assert.deepEqual(parseText("\u4eca\u5929\u60f3\u5230\u4e00\u4e2a\u70b9"), {
    type: "capture",
    content: "\u4eca\u5929\u60f3\u5230\u4e00\u4e2a\u70b9"
  });
});

test("normalizes multiline into one line", () => {
  assert.deepEqual(parseText("first\nsecond\n\nthird"), {
    type: "capture",
    content: "first / second / third"
  });
});

test("reports empty capture for whitespace", () => {
  assert.deepEqual(parseText("   "), { type: "empty" });
});

test("parses help", () => {
  assert.deepEqual(parseText("help"), { type: "help" });
});

test("trims surrounding whitespace", () => {
  assert.deepEqual(parseText("  hello world  "), {
    type: "capture",
    content: "hello world"
  });
});
