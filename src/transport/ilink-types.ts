export type ILinkAuthState = {
  token?: string;
  uin?: string;
  getUpdatesBuf?: string;
  updatedAt?: string;
};

export type ILinkUpdate = Record<string, unknown>;

export type GetUpdatesResult = {
  updates: ILinkUpdate[];
  cursor?: string;
  auth?: Partial<ILinkAuthState>;
};

export type SendTextMessageParams = {
  toUserId: string;
  contextToken?: string;
  text: string;
};

export type ILinkClientConfig = {
  baseUrl: string;
  getUpdatesPath: string;
  sendMessagePath: string;
  requestTimeoutMs: number;
  auth: ILinkAuthState;
};
