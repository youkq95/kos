import { randomBytes } from "node:crypto";

export function generateXWechatUin(): string {
  const n = randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(n), "utf8").toString("base64");
}
