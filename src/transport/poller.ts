import { normalizeWechatTextMessage } from "../adapter/wechat-message.js";
import type { HandleResult, IncomingTextMessage } from "../capture/message.js";
import type { Logger } from "../utils/logger.js";
import type { ILinkClient } from "./ilink-client.js";
import type { JsonStateStore } from "./state-store.js";

export type PollerOptions = {
  client: ILinkClient;
  stateStore: JsonStateStore;
  initialCursor?: string;
  logger: Logger;
  minBackoffMs: number;
  maxBackoffMs: number;
  onMessage: (message: IncomingTextMessage) => Promise<HandleResult>;
};

export class Poller {
  private stopped = false;
  private cursor: string | undefined;

  constructor(private readonly options: PollerOptions) {
    this.cursor = options.initialCursor;
  }

  async start(): Promise<void> {
    this.options.logger.info("poller started");
    let backoffMs = this.options.minBackoffMs;

    while (!this.stopped) {
      try {
        const result = await this.options.client.getUpdates(this.cursor);
        backoffMs = this.options.minBackoffMs;

        if (result.cursor) {
          this.cursor = result.cursor;
          await this.options.stateStore.patch({
            ...this.options.client.getAuthState(),
            getUpdatesBuf: result.cursor
          });
        } else if (result.auth) {
          await this.options.stateStore.patch(this.options.client.getAuthState());
        }

        for (const update of result.updates) {
          await this.processUpdate(update);
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

  private async processUpdate(update: Record<string, unknown>): Promise<void> {
    const message = normalizeWechatTextMessage(update);
    if (!message) {
      this.options.logger.debug("ignored non-text update", update);
      return;
    }

    try {
      const result = await this.options.onMessage(message);
      if (result.action === "reply") {
        await this.reply(message, result);
      }
    } catch (error) {
      this.options.logger.error("message handling failed", {
        messageId: message.messageId,
        senderId: message.senderId,
        error
      });
    }
  }

  private async reply(message: IncomingTextMessage, result: Extract<HandleResult, { action: "reply" }>): Promise<void> {
    try {
      const replyParams: { toUserId: string; contextToken?: string; text: string } = {
        toUserId: message.chatId || message.senderId,
        text: result.text
      };

      if (message.contextToken) {
        replyParams.contextToken = message.contextToken;
      }

      await this.options.client.sendTextMessage(replyParams);
    } catch (error) {
      this.options.logger.error("reply failed", {
        messageId: message.messageId,
        senderId: message.senderId,
        error
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
