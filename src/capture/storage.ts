import { dirname, isAbsolute } from "node:path";
import { mkdir, open } from "node:fs/promises";
import type { CaptureLogEntry } from "./message.js";
import { formatMarkdownLogEntry } from "./formatter.js";

export interface CaptureStorage {
  ensureReady(): Promise<void>;
  appendLog(entry: CaptureLogEntry): Promise<void>;
}

export type MarkdownFileCaptureStorageOptions = {
  logPath: string;
  timeZone: string;
};

export class MarkdownFileCaptureStorage implements CaptureStorage {
  constructor(private readonly options: MarkdownFileCaptureStorageOptions) {
    if (!isAbsolute(options.logPath)) {
      throw new Error("BRAIN_LOG_PATH must be an absolute path");
    }
  }

  async ensureReady(): Promise<void> {
    await mkdir(dirname(this.options.logPath), { recursive: true });
    const handle = await open(this.options.logPath, "a");
    await handle.close();
  }

  async appendLog(entry: CaptureLogEntry): Promise<void> {
    const line = formatMarkdownLogEntry(entry, this.options.timeZone);
    const handle = await open(this.options.logPath, "a");

    try {
      await handle.appendFile(line, "utf8");
    } finally {
      await handle.close();
    }
  }
}
