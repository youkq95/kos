/**
 * probe-gateway.ts — Dump raw Weixin iLink Bot API responses.
 *
 * Usage:
 *   1. cp .env.example .env and set WEIXIN_BASE_URL
 *   2. npx tsx scripts/probe-gateway.ts [endpoint]
 *
 *   endpoint defaults to "all".
 */
import { readFileSync } from "node:fs";

function loadDotEnv(): void {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    console.log("(no .env, using process.env)");
  }
}

loadDotEnv();

const BASE = process.env.WEIXIN_BASE_URL || "";
if (!BASE) {
  console.error("Set WEIXIN_BASE_URL in .env");
  process.exit(1);
}
const TOKEN = process.env.WEIXIN_BOT_TOKEN || "";

async function getReq(path: string, params?: Record<string, string>): Promise<void> {
  const url = new URL(path, BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  console.log(`\n=== GET ${url} ===`);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    console.log(`Status: ${res.status} ${res.statusText}`);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
  } catch (err) {
    console.error("Request failed:", err);
  }
}

async function postReq(path: string, body: unknown): Promise<void> {
  const url = new URL(path, BASE);
  console.log(`\n=== POST ${url} ===`);
  console.log("Request body:", JSON.stringify(body, null, 2));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        AuthorizationType: "ilink_bot_token",
        Authorization: `Bearer ${TOKEN}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000)
    });
    const text = await res.text();
    console.log(`Status: ${res.status} ${res.statusText}`);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
  } catch (err) {
    console.error("Request failed:", err);
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2] || "all";

  if (arg === "qr" || arg === "all") {
    console.log("\n══════════ getBotQRCode ══════════");
    await getReq("/ilink/bot/get_bot_qrcode", { bot_type: "3" });
  }

  if (arg === "check" || arg === "all") {
    console.log("\n══════════ getQRCodeStatus ══════════");
    await getReq("/ilink/bot/get_qrcode_status", { qrcode: "dummy-probe" });
  }

  if (arg === "updates" || arg === "all") {
    console.log("\n══════════ getUpdates ══════════");
    await postReq("/ilink/bot/getupdates", {
      get_updates_buf: "",
      base_info: { channel_version: "kos-weixin/0.1" }
    });
  }
}

main().catch(console.error);
