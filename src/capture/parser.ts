import type { CaptureCommand } from "./message.js";
import { normalizeCaptureContent, normalizeCommandText } from "../utils/normalize.js";

export function parseText(text: string): CaptureCommand {
  const trimmed = normalizeCommandText(text);
  const lower = trimmed.toLowerCase();

  if (lower === "help" || trimmed === "\u5e2e\u52a9") {
    return { type: "help" };
  }

  const captureContent = extractCaptureContent(trimmed);
  if (captureContent === undefined) {
    return { type: "ignore" };
  }

  const normalized = normalizeCaptureContent(captureContent);
  if (!normalized) {
    return { type: "empty" };
  }

  return {
    type: "capture",
    content: normalized
  };
}

function extractCaptureContent(text: string): string | undefined {
  if (text === "k" || text.startsWith("k ") || text.startsWith("k\n") || text.startsWith("k\t")) {
    return text.slice(1);
  }

  if (text === "\u8bb0" || text.startsWith("\u8bb0 ") || text.startsWith("\u8bb0\n") || text.startsWith("\u8bb0\t")) {
    return text.slice(1);
  }

  return undefined;
}
