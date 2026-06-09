import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { WeixinClient } from "../src/transport/ilink-client.js";

const BASE = "https://ilinkai.weixin.qq.com";

function makeClient(auth = {}): WeixinClient {
  return new WeixinClient({
    baseUrl: BASE,
    requestTimeoutMs: 10000,
    auth
  });
}

function mockFetch(json: unknown, status = 200): void {
  mock.method(
    globalThis,
    "fetch",
    (): Promise<Response> =>
      Promise.resolve(
        new Response(JSON.stringify(json), {
          status,
          headers: { "content-type": "application/json" }
        })
      )
  );
}

beforeEach(() => mock.restoreAll?.() ?? undefined);
afterEach(() => mock.restoreAll?.() ?? undefined);

test("getQRCodeStatus returns waiting for unknown status", async () => {
  mockFetch({ status: "waiting" });

  const client = makeClient();
  const result = await client.getQRCodeStatus("test-qrcode");

  assert.equal(result.status, "waiting");
});

test("getQRCodeStatus handles real API value 'wait'", async () => {
  mockFetch({ status: "wait" });

  const client = makeClient();
  const result = await client.getQRCodeStatus("test-qrcode");

  assert.equal(result.status, "waiting");
});

test("getQRCodeStatus handles real API value 'scaned' (one n)", async () => {
  mockFetch({ status: "scaned" });

  const client = makeClient();
  const result = await client.getQRCodeStatus("test-qrcode");

  assert.equal(result.status, "scanned");
});

test("getQRCodeStatus returns scanned", async () => {
  mockFetch({ status: "scanned" });

  const client = makeClient();
  const result = await client.getQRCodeStatus("test-qrcode");

  assert.equal(result.status, "scanned");
});

test("getQRCodeStatus returns confirmed with credentials", async () => {
  mockFetch({
    status: "confirmed",
    bot_token: "my-bot-token",
    baseurl: "https://custom.base.url",
    ilink_bot_id: "bot-123",
    ilink_user_id: "user-456",
    route_tag: "tag-xyz"
  });

  const client = makeClient();
  const result = await client.getQRCodeStatus("test-qrcode");

  assert.equal(result.status, "confirmed");
  assert.equal(result.botToken, "my-bot-token");
  assert.equal(result.baseUrl, "https://custom.base.url");
  assert.equal(result.botId, "bot-123");
  assert.equal(result.userId, "user-456");
  assert.equal(result.routeTag, "tag-xyz");
});

test("getQRCodeStatus maps numeric status 2 as confirmed", async () => {
  mockFetch({ status: "2", bot_token: "token-numeric" });

  const client = makeClient();
  const result = await client.getQRCodeStatus("test-qrcode");

  assert.equal(result.status, "confirmed");
  assert.equal(result.botToken, "token-numeric");
});

test("getQRCodeStatus returns expired", async () => {
  mockFetch({ status: "timeout" });

  const client = makeClient();
  const result = await client.getQRCodeStatus("test-qrcode");

  assert.equal(result.status, "expired");
});

test("getQRCodeStatus returns cancelled", async () => {
  mockFetch({ status: "cancelled" });

  const client = makeClient();
  const result = await client.getQRCodeStatus("test-qrcode");

  assert.equal(result.status, "cancelled");
});

test("getQRCodeStatus handles non-zero ret as waiting", async () => {
  mockFetch({ status: "confirmed", ret: 1, bot_token: "should-not-return" });

  const client = makeClient();
  const result = await client.getQRCodeStatus("test-qrcode");

  assert.equal(result.status, "waiting");
  assert.equal(result.botToken, undefined);
});

test("getBotQRCode returns qrcode and image", async () => {
  mockFetch({
    qrcode: "qr-token-abc",
    qrcode_img_content: "base64imagedata"
  });

  const client = makeClient();
  const result = await client.getBotQRCode();

  assert.equal(result.qrcode, "qr-token-abc");
  assert.equal(result.qrcodeImgBase64, "base64imagedata");
});

test("getBotQRCode accepts snake_case aliases", async () => {
  mockFetch({
    qr_code: "qr-alt",
    qrcode_img: "base64alt"
  });

  const client = makeClient();
  const result = await client.getBotQRCode();

  assert.equal(result.qrcode, "qr-alt");
  assert.equal(result.qrcodeImgBase64, "base64alt");
});

test("getUpdates parses real message structure", async () => {
  mockFetch({
    ret: 0,
    msgs: [
      {
        from_user_id: "user123@im.wechat",
        to_user_id: "bot456@im.bot",
        message_type: 1,
        message_state: 2,
        context_token: "ctx-123",
        item_list: [
          {
            type: 1,
            text_item: { text: "k hello" }
          }
        ]
      }
    ],
    get_updates_buf: "cursor-abc"
  });

  const client = makeClient({ botToken: "test-token" });
  const result = await client.getUpdates();

  assert.equal(result.ret, 0);
  assert.equal(result.getUpdatesBuf, "cursor-abc");
  assert.equal(result.msgs.length, 1);
  assert.equal(result.msgs[0]?.fromUserId, "user123@im.wechat");
  assert.equal(result.msgs[0]?.contextToken, "ctx-123");
  assert.equal(result.msgs[0]?.itemList[0]?.textItem?.text, "k hello");
});

test("sendMessage posts correct body structure", async () => {
  let capturedBody: Record<string, unknown> = {};

  mock.method(globalThis, "fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    return Promise.resolve(
      new Response(JSON.stringify({ ret: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
  });

  const client = makeClient({ botToken: "test-token" });
  await client.sendMessage({
    toUserId: "user123@im.wechat",
    contextToken: "ctx-456",
    text: "已记录。"
  });

  const body = capturedBody;
  const baseInfo = body.base_info as Record<string, unknown> | undefined;
  const msg = body.msg as Record<string, unknown> | undefined;
  const itemList = msg?.item_list as Array<Record<string, unknown>> | undefined;
  const textItem = itemList?.[0]?.text_item as Record<string, unknown> | undefined;

  assert.equal(baseInfo?.channel_version, "kos-weixin/0.1");
  assert.equal(msg?.from_user_id, "");
  assert.ok(typeof msg?.client_id === "string" && msg.client_id.length > 0, "client_id should be a non-empty UUID");
  assert.equal(msg?.to_user_id, "user123@im.wechat");
  assert.equal(msg?.context_token, "ctx-456");
  assert.equal(msg?.message_type, 2);
  assert.equal(textItem?.text, "已记录。");
});
