import { loadConfig, loadDotEnv } from "./config.js";
import { handleIncomingText } from "./capture/handler.js";
import { MarkdownFileCaptureStorage } from "./capture/storage.js";
import { WeixinClient } from "./transport/ilink-client.js";
import { loadInitialAuthState, type LoadInitialAuthOptions } from "./transport/auth.js";
import { runWeixinLoginFlow } from "./transport/login.js";
import { Poller, type PollerOptions } from "./transport/poller.js";
import { JsonStateStore } from "./transport/state-store.js";
import { Logger } from "./utils/logger.js";

async function main(): Promise<void> {
  loadDotEnv();

  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const stateStore = new JsonStateStore(config.statePath);

  // ── Load / acquire credentials ──────────────────────────────────

  const authOptions: LoadInitialAuthOptions = {};
  if (config.weixin.botToken) authOptions.envBotToken = config.weixin.botToken;
  if (config.weixin.botId) authOptions.envBotId = config.weixin.botId;
  if (config.weixin.userId) authOptions.envUserId = config.weixin.userId;
  if (config.weixin.routeTag) authOptions.envRouteTag = config.weixin.routeTag;

  let auth = await loadInitialAuthState(stateStore, authOptions);
  await stateStore.patch(auth);

  if (!auth.botToken) {
    logger.info("no saved botToken, starting Weixin QR login flow");

    const abortController = new AbortController();

    const onShutdown = (): void => {
      logger.info("shutdown signal received during login");
      abortController.abort();
    };

    process.once("SIGINT", onShutdown);
    process.once("SIGTERM", onShutdown);

    try {
      const loginClient = new WeixinClient({
        baseUrl: config.weixin.baseUrl,
        requestTimeoutMs: config.weixin.requestTimeoutMs,
        auth: {}
      });

      auth = await runWeixinLoginFlow({
        client: loginClient,
        qrOutputPath: config.login.qrOutputPath,
        pollIntervalMs: config.login.pollIntervalMs,
        signal: abortController.signal,
        logger
      });

      await stateStore.write(auth);
      logger.info("credentials saved after login");
    } catch (error) {
      if (abortController.signal.aborted) {
        logger.info("login aborted by signal");
        return;
      }

      throw error;
    } finally {
      process.removeListener("SIGINT", onShutdown);
      process.removeListener("SIGTERM", onShutdown);
    }
  }

  // ── Start polling loop ──────────────────────────────────────────

  const client = new WeixinClient({
    baseUrl: config.weixin.baseUrl,
    requestTimeoutMs: config.weixin.requestTimeoutMs,
    auth
  });

  const storage = new MarkdownFileCaptureStorage({
    logPath: config.brainLogPath,
    timeZone: config.timeZone
  });
  await storage.ensureReady();

  const pollerOptions: PollerOptions = {
    client,
    stateStore,
    logger,
    minBackoffMs: config.poller.minBackoffMs,
    maxBackoffMs: config.poller.maxBackoffMs,
    onMessage: (message) =>
      handleIncomingText(message, {
        allowedSenders: config.allowedSenders,
        storage,
        logger
      })
  };

  if (auth.getUpdatesBuf) {
    pollerOptions.initialCursor = auth.getUpdatesBuf;
  }

  const poller = new Poller(pollerOptions);

  process.once("SIGINT", () => poller.stop());
  process.once("SIGTERM", () => poller.stop());

  await poller.start();
}

main().catch((error) => {
  const logger = new Logger("error");
  logger.error("fatal error", error);
  process.exitCode = 1;
});
