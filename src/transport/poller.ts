import { normalizeWechatTextMessage } from "../adapter/wechat-message.js";
import type { HandleResult, IncomingTextMessage } from "../capture/message.js";
import type { Logger } from "../utils/logger.js";
import type { WeixinClient } from "./ilink-client.js";
import type { JsonStateStore } from "./state-store.js";

export type PollerOptions = {
  client: WeixinClient;
  stateStore: JsonStateStore;
  initialCursor?: string;
  logger: Logger;
  minBackoffMs: number;
  maxBackoffMs: number;
  onMessage: (message: IncomingTextMessage) => Promise<HandleResult>;
};

export class Poller {
  private stopped = false;

  constructor(private readonly options: PollerOptions) {
    // initialCursor is already set in client's auth state by index.ts
  }

  async start(): Promise<void> {
    this.options.logger.info("poller started");
    let backoffMs = this.options.minBackoffMs;

    while (!this.stopped) {
      try {
        const result = await this.options.client.getUpdates();
        backoffMs = this.options.minBackoffMs;

        // Persist cursor
        if (result.getUpdatesBuf) {
          this.options.client.mergeAuthState({ getUpdatesBuf: result.getUpdatesBuf });
          await this.options.stateStore.patch({
            ...this.options.client.getAuthState(),
            getUpdatesBuf: result.getUpdatesBuf
          });
        }

        for (const msg of result.msgs) {
          await this.processUpdate(msg);
        }
      } catch (error) {
        if (this.stopped) {
          break;
        }

        this.options.logger.error("polling failed", error);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, this.options.maxBackoffMs);
      }
    }

    this.options.logger.info("poller stopped");
  }

  stop(): void {
    this.stopped = true;
  }

  private async processUpdate(msg: unknown): Promise<void> {
    // Log all incoming messages so the user can discover their sender ID
    const inbound = msg as Record<string, unknown>;
    const rawSender = inbound.from_user_id ?? inbound.fromUserId;
    const rawType = inbound.message_type ?? inbound.messageType;
    this.options.logger.debug("incoming message", {
      senderId: rawSender,
      messageType: rawType
    });

    // msg is already InboundMsg from getUpdates response
    const message = normalizeWechatTextMessage(msg as Parameters<typeof normalizeWechatTextMessage>[0]);
    if (!message) {
      return;
    }

    try {
      const result = await this.options.onMessage(message);
      if (result.action === "reply") {
        await this.reply(message, result);
      }
    } catch (error) {
      this.options.logger.error("message handling failed", {
        senderId: message.senderId,
        error
      });
    }
  }

  private async reply(
    message: IncomingTextMessage,
    result: Extract<HandleResult, { action: "reply" }>
  ): Promise<void> {
    if (!message.contextToken) {
      this.options.logger.error("cannot reply without contextToken", {
        senderId: message.senderId
      });
      return;
    }

    try {
      await this.options.client.sendMessage({
        toUserId: message.senderId,
        contextToken: message.contextToken,
        text: result.text
      });
    } catch (error) {
      this.options.logger.error("reply failed", {
        senderId: message.senderId,
        error
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
