import type { ILinkAuthState } from "./ilink-types.js";
import type { JsonStateStore } from "./state-store.js";

export type LoadInitialAuthOptions = {
  envToken?: string;
  envUin?: string;
};

export async function loadInitialAuthState(
  store: JsonStateStore,
  options: LoadInitialAuthOptions
): Promise<ILinkAuthState> {
  const saved = await store.read();
  const state: ILinkAuthState = {};

  const token = options.envToken || saved.token;
  const uin = options.envUin || saved.uin;

  if (token) {
    state.token = token;
  }

  if (uin) {
    state.uin = uin;
  }

  if (saved.getUpdatesBuf) {
    state.getUpdatesBuf = saved.getUpdatesBuf;
  }

  if (saved.updatedAt) {
    state.updatedAt = saved.updatedAt;
  }

  return state;
}
