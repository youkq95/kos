// Exact types for the Weixin iLink Bot API.
// Endpoints: https://ilinkai.weixin.qq.com/ilink/bot/*

export type WeixinAuthState = {
  botToken?: string;
  botId?: string;
  userId?: string;
  baseUrl?: string;
  routeTag?: string;
  getUpdatesBuf?: string;
  updatedAt?: string;
};

export type QRCodeResult = {
  qrcode: string;
  qrcodeImgBase64: string;
};

export type QRCodeStatus = "waiting" | "scanned" | "confirmed" | "expired" | "cancelled";

export type QRCodeStatusResult = {
  status: QRCodeStatus;
  botToken?: string;
  baseUrl?: string;
  botId?: string;
  userId?: string;
  routeTag?: string;
};

export type InboundMsgItem = {
  type: number;
  textItem?: {
    text: string;
  };
};

export type InboundMsg = {
  fromUserId: string;
  toUserId: string;
  messageType: number;
  messageState: number;
  contextToken?: string;
  itemList: InboundMsgItem[];
  raw: unknown;
};

export type GetUpdatesResponse = {
  ret: number;
  msgs: InboundMsg[];
  getUpdatesBuf: string;
  longpollingTimeoutMs?: number;
};
