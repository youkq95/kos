import { dirname, isAbsolute } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { ILinkAuthState } from "./ilink-types.js";

export class JsonStateStore {
  constructor(private readonly path: string) {
    if (!isAbsolute(path)) {
      throw new Error("STATE_PATH must be an absolute path");
    }
  }

  async read(): Promise<ILinkAuthState> {
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

  async write(state: ILinkAuthState): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const finalState = {
      ...state,
      updatedAt: new Date().toISOString()
    };
    const tempPath = `${this.path}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(finalState, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(tempPath, this.path);
  }

  async patch(patch: Partial<ILinkAuthState>): Promise<ILinkAuthState> {
    const current = await this.read();
    const next = {
      ...current,
      ...withoutUndefined(patch)
    };
    await this.write(next);
    return next;
  }
}

function sanitizeState(record: Record<string, unknown>): ILinkAuthState {
  const state: ILinkAuthState = {};

  if (typeof record.token === "string") {
    state.token = record.token;
  }

  if (typeof record.uin === "string") {
    state.uin = record.uin;
  }

  if (typeof record.getUpdatesBuf === "string") {
    state.getUpdatesBuf = record.getUpdatesBuf;
  }

  if (typeof record.updatedAt === "string") {
    state.updatedAt = record.updatedAt;
  }

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
