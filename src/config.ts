import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parseCommaSeparatedSet } from "./utils/normalize.js";
import { assertValidTimeZone } from "./utils/time.js";
import { parseLogLevel, type LogLevel } from "./utils/logger.js";

export type AppConfig = {
  brainLogPath: string;
  allowedSenders: Set<string>;
  timeZone: string;
  statePath: string;
  logLevel: LogLevel;
  ilink: {
    baseUrl: string;
    getUpdatesPath: string;
    sendMessagePath: string;
    authToken?: string;
    uin?: string;
    requestTimeoutMs: number;
  };
  poller: {
    minBackoffMs: number;
    maxBackoffMs: number;
  };
};

export function loadDotEnv(path = ".env"): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), path), "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      const value = stripQuotes(trimmed.slice(equalsIndex + 1).trim());

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const brainLogPath = requiredAbsolutePath(env.BRAIN_LOG_PATH, "BRAIN_LOG_PATH");
  const statePath = requiredAbsolutePath(env.STATE_PATH, "STATE_PATH");
  const allowedSenders = parseCommaSeparatedSet(env.ALLOWED_SENDERS);

  if (allowedSenders.size === 0) {
    throw new Error("ALLOWED_SENDERS must contain at least one sender ID");
  }

  const timeZone = env.TIMEZONE || "Asia/Shanghai";
  assertValidTimeZone(timeZone);

  const ilinkBaseUrl = required(env.ILINK_BASE_URL, "ILINK_BASE_URL");
  const authToken = optionalNonEmpty(env.ILINK_AUTH_TOKEN);
  const uin = optionalNonEmpty(env.ILINK_UIN);

  return {
    brainLogPath,
    allowedSenders,
    timeZone,
    statePath,
    logLevel: parseLogLevel(env.LOG_LEVEL),
    ilink: {
      baseUrl: ilinkBaseUrl,
      getUpdatesPath: env.ILINK_GET_UPDATES_PATH || "/api/getUpdates",
      sendMessagePath: env.ILINK_SEND_MESSAGE_PATH || "/api/sendMessage",
      requestTimeoutMs: parsePositiveInt(env.ILINK_REQUEST_TIMEOUT_MS, 65_000),
      ...(authToken ? { authToken } : {}),
      ...(uin ? { uin } : {})
    },
    poller: {
      minBackoffMs: parsePositiveInt(env.POLLER_MIN_BACKOFF_MS, 1_000),
      maxBackoffMs: parsePositiveInt(env.POLLER_MAX_BACKOFF_MS, 30_000)
    }
  };
}

function required(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

function optionalNonEmpty(value: string | undefined): string | undefined {
  if (!value || !value.trim()) {
    return undefined;
  }

  return value.trim();
}

function requiredAbsolutePath(value: string | undefined, name: string): string {
  const result = required(value, name);
  if (!isAbsolute(result)) {
    throw new Error(`${name} must be an absolute path`);
  }

  return result;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
