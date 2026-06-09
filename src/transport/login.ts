import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import QRCode from "qrcode";
import type { WeixinAuthState, QRCodeStatus } from "./ilink-types.js";
import type { WeixinClient } from "./ilink-client.js";
import type { Logger } from "../utils/logger.js";

export type WeixinLoginOptions = {
  client: WeixinClient;
  qrOutputPath: string;
  pollIntervalMs: number;
  signal: AbortSignal;
  logger: Logger;
};

export async function runWeixinLoginFlow(options: WeixinLoginOptions): Promise<WeixinAuthState> {
  const { client, qrOutputPath, pollIntervalMs, signal, logger } = options;

  logger.info("starting Weixin QR login flow");

  while (!signal.aborted) {
    // 1. Get QR code
    let qr;
    try {
      qr = await client.getBotQRCode();
    } catch (error) {
      if (signal.aborted) break;
      logger.error("failed to get QR code, retrying", error);
      await sleep(pollIntervalMs, signal);
      continue;
    }

    if (signal.aborted) break;

    // 2. Save & display QR
    await saveQRImage(qr.qrcodeImgBase64, qrOutputPath, logger);

    // 3. Poll status
    const result = await pollQRStatus(client, qr.qrcode, pollIntervalMs, signal, logger);

    if (result.status === "confirmed" && result.botToken) {
      logger.info("login confirmed", {
        botId: result.botId,
        userId: result.userId,
        hasBaseUrl: !!result.baseUrl
      });

      const state: WeixinAuthState = {
        botToken: result.botToken,
        updatedAt: new Date().toISOString()
      };

      if (result.botId) state.botId = result.botId;
      if (result.userId) state.userId = result.userId;
      if (result.baseUrl) state.baseUrl = result.baseUrl;
      if (result.routeTag) state.routeTag = result.routeTag;

      return state;
    }

    if (result.status === "expired" || result.status === "cancelled") {
      logger.info(`QR code ${result.status}, requesting a new one`);
      continue;
    }

    break;
  }

  throw new Error("login flow aborted");
}

function getQRStatusIcon(status: QRCodeStatus): string {
  const icons: Record<QRCodeStatus, string> = {
    waiting: "⏳",
    scanned: "📱",
    confirmed: "✅",
    expired: "⏰",
    cancelled: "🚫"
  };
  return icons[status] ?? "❓";
}

async function saveQRImage(base64: string, outputPath: string, logger: Logger): Promise<void> {
  // Render QR in terminal
  try {
    const qrString = await QRCode.toString(base64, {
      type: "terminal",
      small: true
    });
    console.log("\n" + qrString + "\n");
  } catch {
    // terminal rendering failed — not critical
  }

  // Also save to file as backup
  try {
    const buffer = Buffer.from(base64, "base64");
    await writeFile(outputPath, buffer);
    logger.info("QR code also saved to file", { path: outputPath });
  } catch {
    // file save failed — already rendered in terminal, so OK
  }
}

async function pollQRStatus(
  client: WeixinClient,
  qrcode: string,
  pollIntervalMs: number,
  signal: AbortSignal,
  logger: Logger
): Promise<{ status: QRCodeStatus; botToken?: string; baseUrl?: string; botId?: string; userId?: string; routeTag?: string }> {
  let prevStatus: QRCodeStatus = "waiting";

  while (!signal.aborted) {
    await sleep(pollIntervalMs, signal);
    if (signal.aborted) break;

    try {
      const result = await client.getQRCodeStatus(qrcode);

      if (result.status !== prevStatus) {
        logger.info(`QR status: ${result.status} ${getQRStatusIcon(result.status)}`);
        prevStatus = result.status;
      } else {
        logger.debug(`QR status: ${result.status}`);
      }

      if (result.status === "confirmed" || result.status === "expired" || result.status === "cancelled") {
        return result;
      }
    } catch (error) {
      logger.error("QR status check failed, retrying", error);
    }
  }

  return { status: "waiting" };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();

    const timer = setTimeout(resolve, ms);

    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
