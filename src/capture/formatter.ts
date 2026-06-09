import type { CaptureLogEntry } from "./message.js";
import { formatTimestamp } from "../utils/time.js";

export function formatMarkdownLogEntry(entry: CaptureLogEntry, timeZone: string): string {
  const timestamp = formatTimestamp(entry.timestamp, timeZone);
  return `\n- ${timestamp} [${entry.source}]: ${entry.content}\n`;
}

export const HELP_TEXT = [
  "\u53ef\u7528\u547d\u4ee4\uff1a",
  "k \u5185\u5bb9   \u8bb0\u5f55\u5230 log.md",
  "\u8bb0 \u5185\u5bb9  \u8bb0\u5f55\u5230 log.md",
  "help    \u67e5\u770b\u5e2e\u52a9"
].join("\n");

export const CAPTURED_REPLY = "\u5df2\u8bb0\u5f55\u3002";
export const EMPTY_CAPTURE_REPLY = "\u5185\u5bb9\u4e3a\u7a7a\uff0c\u672a\u8bb0\u5f55\u3002";
