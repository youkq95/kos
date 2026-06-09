import type { CaptureLogEntry } from "./message.js";
import { formatTimestamp } from "../utils/time.js";

export function formatMarkdownLogEntry(entry: CaptureLogEntry, timeZone: string): string {
  const timestamp = formatTimestamp(entry.timestamp, timeZone);
  return `\n- ${timestamp} [${entry.source}]: ${entry.content}\n`;
}

export const HELP_TEXT = [
  "\u53d1\u9001\u4efb\u4f55\u6d88\u606f\u5373\u53ef\u8bb0\u5f55\u5230 log.md",
  "\u53d1\u9001 help \u67e5\u770b\u6b64\u5e2e\u52a9"
].join("\n");

export const CAPTURED_REPLY = "\u5df2\u8bb0\u5f55\u3002";
export const EMPTY_CAPTURE_REPLY = "\u5185\u5bb9\u4e3a\u7a7a\uff0c\u672a\u8bb0\u5f55\u3002";
