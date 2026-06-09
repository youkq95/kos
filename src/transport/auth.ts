import type { WeixinAuthState } from "./ilink-types.js";
import type { JsonStateStore } from "./state-store.js";

export type LoadInitialAuthOptions = {
  envBotToken?: string;
  envBotId?: string;
  envUserId?: string;
  envRouteTag?: string;
};

export async function loadInitialAuthState(
  store: JsonStateStore,
  options: LoadInitialAuthOptions
): Promise<WeixinAuthState> {
  const saved = await store.read();
  const state: WeixinAuthState = {};

  const botToken = options.envBotToken || saved.botToken;
  const botId = options.envBotId || saved.botId;
  const userId = options.envUserId || saved.userId;
  const routeTag = options.envRouteTag || saved.routeTag;

  if (botToken) state.botToken = botToken;
  if (botId) state.botId = botId;
  if (userId) state.userId = userId;
  if (routeTag) state.routeTag = routeTag;
  if (saved.baseUrl) state.baseUrl = saved.baseUrl;
  if (saved.getUpdatesBuf) state.getUpdatesBuf = saved.getUpdatesBuf;
  if (saved.updatedAt) state.updatedAt = saved.updatedAt;

  return state;
}
