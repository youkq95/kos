import { dirname, isAbsolute } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { WeixinAuthState } from "./ilink-types.js";

export class JsonStateStore {
  constructor(private readonly path: string) {
    if (!isAbsolute(path)) {
      throw new Error("STATE_PATH must be an absolute path");
    }
  }

  async read(): Promise<WeixinAuthState> {
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as unknown;

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }

      return sanitizeState(parsed as Record<string, unknown>);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }

  async write(state: WeixinAuthState): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const finalState = {
      ...state,
      updatedAt: new Date().toISOString()
    };
    const tempPath = `${this.path}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(finalState, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(tempPath, this.path);
  }

  async patch(patch: Partial<WeixinAuthState>): Promise<WeixinAuthState> {
    const current = await this.read();
    const next = {
      ...current,
      ...withoutUndefined(patch)
    };
    await this.write(next);
    return next;
  }
}

function sanitizeState(record: Record<string, unknown>): WeixinAuthState {
  const state: WeixinAuthState = {};

  if (typeof record.botToken === "string") state.botToken = record.botToken;
  if (typeof record.botId === "string") state.botId = record.botId;
  if (typeof record.userId === "string") state.userId = record.userId;
  if (typeof record.baseUrl === "string") state.baseUrl = record.baseUrl;
  if (typeof record.routeTag === "string") state.routeTag = record.routeTag;
  if (typeof record.getUpdatesBuf === "string") state.getUpdatesBuf = record.getUpdatesBuf;
  if (typeof record.updatedAt === "string") state.updatedAt = record.updatedAt;

  return state;
}

function withoutUndefined<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
