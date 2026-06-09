import type {
  GetUpdatesResponse,
  InboundMsg,
  QRCodeResult,
  QRCodeStatus,
  QRCodeStatusResult,
  WeixinAuthState
} from "./ilink-types.js";
import { generateXWechatUin } from "../utils/weixin.js";
import { randomUUID } from "node:crypto";

export type WeixinClientConfig = {
  baseUrl: string;
  requestTimeoutMs: number;
  auth: WeixinAuthState;
};

export class WeixinClient {
  private auth: WeixinAuthState;

  constructor(private readonly config: WeixinClientConfig) {
    this.auth = { ...config.auth };
  }

  getAuthState(): WeixinAuthState {
    return { ...this.auth };
  }

  mergeAuthState(patch: Partial<WeixinAuthState>): WeixinAuthState {
    this.auth = {
      ...this.auth,
      ...withoutUndefined(patch)
    };
    return this.getAuthState();
  }

  // ── QR login (no auth headers needed) ────────────────────────────

  async getBotQRCode(botType = 3): Promise<QRCodeResult> {
    const url = new URL("/ilink/bot/get_bot_qrcode", this.config.baseUrl);
    url.searchParams.set("bot_type", String(botType));

    const response = await this.fetchWithTimeout(url, { method: "GET" });
    const raw = await this.readJson(response);
    const data = asRecord(raw) ?? {};
    assertOk(response, data);

    const qrcode = firstString(data.qrcode, data.qr_code, data.qrCode);
    const img = firstString(
      data.qrcode_img_content,
      data.qrcodeImgContent,
      data.qrCodeImgContent,
      data.qrcode_img,
      data.qr_img_base64
    );

    if (!qrcode) {
      throw new Error(`getBotQRCode missing qrcode: ${summary(data)}`);
    }
    if (!img) {
      throw new Error(`getBotQRCode missing qrcode_img_content: ${summary(data)}`);
    }

    return { qrcode, qrcodeImgBase64: img };
  }

  async getQRCodeStatus(qrcode: string): Promise<QRCodeStatusResult> {
    const url = new URL("/ilink/bot/get_qrcode_status", this.config.baseUrl);
    url.searchParams.set("qrcode", qrcode);

    const response = await this.fetchWithTimeout(url, { method: "GET" });
    const raw = await this.readJson(response);
    const data = asRecord(raw) ?? {};
    assertOk(response, data);

    const status = normalizeQRStatus(
      firstString(data.status, data.state, data.qr_status, data.qrStatus)
    );

    const result: QRCodeStatusResult = { status };

    if (status === "confirmed") {
      const botToken = firstString(data.bot_token, data.botToken);
      const baseUrl = firstString(data.baseurl, data.baseUrl, data.base_url);
      const botId = firstString(data.ilink_bot_id, data.ilinkBotId, data.bot_id, data.botId);
      const userId = firstString(data.ilink_user_id, data.ilinkUserId, data.user_id, data.userId);
      const routeTag = firstString(data.route_tag, data.routeTag);
      const ret = typeof data.ret === "number" ? data.ret : undefined;

      if (ret !== undefined && ret !== 0) {
        // non-zero ret even with "confirmed" status — treat as still waiting
        return { status: "waiting" };
      }

      if (botToken) result.botToken = botToken;
      if (baseUrl) result.baseUrl = baseUrl;
      if (botId) result.botId = botId;
      if (userId) result.userId = userId;
      if (routeTag) result.routeTag = routeTag;
    }

    return result;
  }

  // ── Message operations (requires auth headers) ───────────────────

  async getUpdates(): Promise<GetUpdatesResponse> {
    const body: Record<string, unknown> = {
      get_updates_buf: this.auth.getUpdatesBuf ?? "",
      base_info: {
        channel_version: "kos-weixin/0.1"
      }
    };

    const raw = await this.authPost("/ilink/bot/getupdates", body);
    const data = asRecord(raw) ?? {};
    assertOkResponse(data);

    const msgs: InboundMsg[] = [];
    const rawMsgs = Array.isArray(data.msgs) ? data.msgs : [];
    for (const raw of rawMsgs) {
      const msg = asRecord(raw);
      if (!msg) continue;
      msgs.push(this.parseInboundMsg(msg));
    }

    return {
      ret: typeof data.ret === "number" ? data.ret : -1,
      msgs,
      getUpdatesBuf: firstString(data.get_updates_buf, data.getUpdatesBuf) ?? "",
      ...(typeof data.longpolling_timeout_ms === "number"
        ? { longpollingTimeoutMs: data.longpolling_timeout_ms }
        : typeof data.longpollingTimeoutMs === "number"
          ? { longpollingTimeoutMs: data.longpollingTimeoutMs }
          : {})
    };
  }

  async sendMessage(params: {
    toUserId: string;
    contextToken: string;
    text: string;
  }): Promise<void> {
    const body = {
      msg: {
        from_user_id: "",
        to_user_id: params.toUserId,
        client_id: randomUUID(),
        message_type: 2,
        message_state: 2,
        context_token: params.contextToken,
        item_list: [
          {
            type: 1,
            text_item: {
              text: params.text
            }
          }
        ]
      },
      base_info: {
        channel_version: "kos-weixin/0.1"
      }
    };

    const data = await this.authPost("/ilink/bot/sendmessage", body);
    assertOkResponse(data);
  }

  // ── internals ───────────────────────────────────────────────────

  private parseInboundMsg(msg: Record<string, unknown>): InboundMsg {
    const itemList: InboundMsg["itemList"] = [];
    const rawItems = Array.isArray(msg.item_list) ? msg.item_list : [];

    for (const raw of rawItems) {
      const item = asRecord(raw);
      if (!item) continue;

      const parsed: InboundMsg["itemList"][number] = {
        type: typeof item.type === "number" ? item.type : 0
      };

      const textItem = asRecord(item.text_item);
      if (textItem && typeof textItem.text === "string") {
        parsed.textItem = { text: textItem.text };
      }

      itemList.push(parsed);
    }

    return {
      fromUserId: firstString(msg.from_user_id, msg.fromUserId) ?? "",
      toUserId: firstString(msg.to_user_id, msg.toUserId) ?? "",
      messageType: typeof msg.message_type === "number" ? msg.message_type : 0,
      messageState: typeof msg.message_state === "number" ? msg.message_state : 0,
      ...(firstString(msg.context_token, msg.contextToken)
        ? { contextToken: firstString(msg.context_token, msg.contextToken)! }
        : {}),
      itemList,
      raw: msg
    };
  }

  private async authPost(path: string, body: unknown): Promise<unknown> {
    const url = new URL(path, this.config.baseUrl);

    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        AuthorizationType: "ilink_bot_token",
        Authorization: `Bearer ${this.auth.botToken ?? ""}`,
        "X-WECHAT-UIN": generateXWechatUin()
      },
      body: JSON.stringify(body)
    });

    return this.readJson(response);
  }

  private async fetchWithTimeout(url: URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    try {
      return text ? (JSON.parse(text) as unknown) : {};
    } catch {
      throw new Error(`Invalid JSON from ${response.url}: ${text.slice(0, 500)}`);
    }
  }
}

// ── helpers ────────────────────────────────────────────────────────

function normalizeQRStatus(raw: string | undefined): QRCodeStatus {
  if (!raw) return "waiting";
  const lower = raw.toLowerCase();
  // Real API returns "wait", "scaned" (one n), "expired", "confirmed"
  if (lower === "confirmed" || lower === "success" || lower === "ok" || lower === "2" || lower === "200") return "confirmed";
  if (lower === "scanned" || lower === "scaned" || lower === "scan" || lower === "1" || lower === "201") return "scanned";
  if (lower === "expired" || lower === "timeout" || lower === "-1" || lower === "408") return "expired";
  if (lower === "cancelled" || lower === "canceled" || lower === "refused" || lower === "3") return "cancelled";
  // "wait" is the real API value for waiting
  return "waiting";
}

function assertOk(response: Response, data: unknown): void {
  if (response.ok) return;
  throw new Error(`Weixin API error ${response.status}: ${summary(data)}`);
}

function assertOkResponse(data: unknown): void {
  const rec = asRecord(data);
  if (!rec) return;
  const ret = typeof rec.ret === "number" ? rec.ret : undefined;
  if (ret !== undefined && ret !== 0) {
    const msg = firstString(rec.err_msg, rec.errMsg, rec.message, rec.msg) ?? "unknown error";
    throw new Error(`Weixin API ret=${ret}: ${msg}`);
  }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function summary(value: unknown): string {
  return JSON.stringify(value).slice(0, 500);
}

function withoutUndefined<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
