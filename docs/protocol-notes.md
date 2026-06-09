# iLink / ClawBot protocol notes

This file tracks the minimal protocol assumptions used by `kos`.

## Scope

The daemon only needs:

1. Saved credential loading.
2. Long-polling `getUpdates`.
3. Sending a private text message reply.
4. Persisting the server cursor/buffer.

No OpenClaw runtime, skill runtime, MCP, LLM, multi-agent routing, media handling, or shell execution is required.

## Current implementation contract

The concrete gateway URL and endpoint paths are config-driven:

- `ILINK_BASE_URL`
- `ILINK_GET_UPDATES_PATH`
- `ILINK_SEND_MESSAGE_PATH`
- `ILINK_AUTH_TOKEN`
- `ILINK_UIN`

`ILinkClient.getUpdates(cursor)` currently sends JSON including the available credential/cursor fields:

```json
{
  "token": "...",
  "uin": "...",
  "getUpdatesBuf": "..."
}
```

The response normalizer accepts common response variants:

- `updates`, `items`, `messages`, or `data.updates` for message arrays.
- `cursor`, `nextCursor`, `getUpdatesBuf`, `buf`, or `data.getUpdatesBuf` for continuation state.
- `token` / `uin` at the top level or under `data` for refreshed auth state.

`sendTextMessage` sends JSON including:

```json
{
  "token": "...",
  "uin": "...",
  "toUserId": "...",
  "contextToken": "...",
  "text": "...",
  "content": "...",
  "type": "text"
}
```

## Adapter assumptions

`normalizeWechatTextMessage` accepts nested and flat message shapes and extracts:

- message ID: `messageId`, `msgId`, or `id`
- sender: `senderId`, `fromUserId`, `fromUserName`, `from`, `userId`, or `wxid`
- chat: `chatId`, `roomId`, `conversationId`, or `talker`
- text: `text`, `content`, or `message`
- timestamp: `timestamp`, `createTime`, or `time`
- context token: `contextToken` or `ctxToken`

## Items to verify with a live gateway

- Exact login flow and credential refresh behavior.
- Whether `getUpdatesBuf` is required in the request body, header, query string, or another field.
- Whether replies require `contextToken`, chat ID, sender ID, or a conversation ID.
- The final private-chat and group-chat markers.
- Rate limits and long-poll timeout recommendations.

## Integration acceptance checklist

- Send `ping`; daemon logs normalized incoming text; reply path can send `pong`.
- Send `k test`; log file appends one line and WeChat receives `已记录。`.
- Restart daemon with existing state file; polling resumes from saved cursor.
