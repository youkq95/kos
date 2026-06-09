import { loadConfig, loadDotEnv } from "./config.js";
import { handleIncomingText } from "./capture/handler.js";
import { MarkdownFileCaptureStorage } from "./capture/storage.js";
import { ILinkClient } from "./transport/ilink-client.js";
import { loadInitialAuthState, type LoadInitialAuthOptions } from "./transport/auth.js";
import { Poller, type PollerOptions } from "./transport/poller.js";
import { JsonStateStore } from "./transport/state-store.js";
import { Logger } from "./utils/logger.js";

async function main(): Promise<void> {
  loadDotEnv();

  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const stateStore = new JsonStateStore(config.statePath);

  const authOptions: LoadInitialAuthOptions = {};
  if (config.ilink.authToken) {
    authOptions.envToken = config.ilink.authToken;
  }
  if (config.ilink.uin) {
    authOptions.envUin = config.ilink.uin;
  }

  const auth = await loadInitialAuthState(stateStore, authOptions);
  await stateStore.patch(auth);

  const client = new ILinkClient({
    baseUrl: config.ilink.baseUrl,
    getUpdatesPath: config.ilink.getUpdatesPath,
    sendMessagePath: config.ilink.sendMessagePath,
    requestTimeoutMs: config.ilink.requestTimeoutMs,
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
