import type {
  GetUpdatesResult,
  ILinkAuthState,
  ILinkClientConfig,
  ILinkUpdate,
  SendTextMessageParams
} from "./ilink-types.js";

export class ILinkClient {
  private auth: ILinkAuthState;

  constructor(private readonly config: ILinkClientConfig) {
    this.auth = { ...config.auth };
  }

  getAuthState(): ILinkAuthState {
    return { ...this.auth };
  }

  mergeAuthState(patch: Partial<ILinkAuthState>): ILinkAuthState {
    this.auth = {
      ...this.auth,
      ...withoutUndefined(patch)
    };
    return this.getAuthState();
  }

  async getUpdates(cursor?: string): Promise<GetUpdatesResult> {
    const body: Record<string, unknown> = {
      token: this.auth.token,
      uin: this.auth.uin,
      getUpdatesBuf: cursor ?? this.auth.getUpdatesBuf
    };

    const raw = await this.postJson(this.config.getUpdatesPath, withoutUndefined(body));
    const result = normalizeGetUpdatesResponse(raw);

    if (result.auth) {
      this.mergeAuthState(result.auth);
    }

    if (result.cursor) {
      this.mergeAuthState({ getUpdatesBuf: result.cursor });
    }

    return result;
  }

  async sendTextMessage(params: SendTextMessageParams): Promise<void> {
    const body: Record<string, unknown> = {
      token: this.auth.token,
      uin: this.auth.uin,
      toUserId: params.toUserId,
      contextToken: params.contextToken,
      text: params.text,
      content: params.text,
      type: "text"
    };

    await this.postJson(this.config.sendMessagePath, withoutUndefined(body));
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await fetch(new URL(path, this.config.baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const text = await response.text();
      const parsed = text ? safeJsonParse(text) : {};

      if (!response.ok) {
        throw new Error(`iLink request failed: ${response.status} ${response.statusText} ${text.slice(0, 500)}`);
      }

      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeGetUpdatesResponse(raw: unknown): GetUpdatesResult {
  const root = asRecord(raw) ?? {};
  const data = asRecord(root.data) ?? root;
  const updatesValue = firstArray(root.updates, root.items, root.messages, data.updates, data.items, data.messages);
  const cursor = firstString(root.cursor, root.nextCursor, root.getUpdatesBuf, root.buf, data.cursor, data.nextCursor, data.getUpdatesBuf, data.buf);
  const authPatch: Partial<ILinkAuthState> = {};
  const token = firstString(root.token, data.token);
  const uin = firstString(root.uin, data.uin);

  if (token) {
    authPatch.token = token;
  }

  if (uin) {
    authPatch.uin = uin;
  }

  if (cursor) {
    authPatch.getUpdatesBuf = cursor;
  }

  const result: GetUpdatesResult = {
    updates: updatesValue.map((item) => (asRecord(item) ?? { value: item }) as ILinkUpdate)
  };

  if (cursor) {
    result.cursor = cursor;
  }

  if (Object.keys(authPatch).length > 0) {
    result.auth = authPatch;
  }

  return result;
}

function firstArray(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON response from iLink: ${text.slice(0, 500)}`, { cause: error });
  }
}

function withoutUndefined<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
