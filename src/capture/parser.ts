import type { CaptureCommand } from "./message.js";
import { normalizeCaptureContent, normalizeCommandText } from "../utils/normalize.js";

export function parseText(text: string): CaptureCommand {
  const trimmed = normalizeCommandText(text);

  // help command
  const lower = trimmed.toLowerCase();
  if (lower === "help" || trimmed === "\u5e2e\u52a9") {
    return { type: "help" };
  }

  // everything else is a capture — no k/记 prefix needed
  if (!normalizeCaptureContent(trimmed)) {
    return { type: "empty" };
  }

  return {
    type: "capture",
    content: normalizeCaptureContent(trimmed)
  };
}
