import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MarkdownFileCaptureStorage } from "../src/capture/storage.js";

test("appends markdown log entry to configured absolute path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kos-storage-"));
  const logPath = join(dir, "brain", "log.md");

  try {
    const storage = new MarkdownFileCaptureStorage({ logPath, timeZone: "UTC" });
    await storage.ensureReady();
    await storage.appendLog({
      content: "hello",
      timestamp: new Date("2026-06-09T08:20:31.000Z"),
      source: "wechat"
    });

    const raw = await readFile(logPath, "utf8");
    assert.equal(raw, "\n- 2026-06-09 08:20:31 [wechat]: hello\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects relative BRAIN_LOG_PATH", () => {
  assert.throws(
    () => new MarkdownFileCaptureStorage({ logPath: "brain/log.md", timeZone: "UTC" }),
    /absolute/
  );
});

test("creates parent directories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kos-storage-parents-"));
  const logPath = join(dir, "nested", "brain", "log.md");

  try {
    const storage = new MarkdownFileCaptureStorage({ logPath, timeZone: "UTC" });
    await storage.ensureReady();
    await mkdir(join(dir, "nested"), { recursive: true });
    await storage.appendLog({ content: "ok", timestamp: new Date("2026-06-09T08:20:31.000Z"), source: "wechat" });
    assert.match(await readFile(logPath, "utf8"), /ok/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
