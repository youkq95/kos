# iLink Bot API protocol notes

All endpoints are under `WEIXIN_BASE_URL` (default `https://ilinkai.weixin.qq.com`).

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/ilink/bot/get_bot_qrcode?bot_type=3` | none | Fetch QR code image + login token |
| GET | `/ilink/bot/get_qrcode_status?qrcode=...` | none | Poll scan/confirm status |
| POST | `/ilink/bot/getupdates` | Bearer | Long-poll new messages |
| POST | `/ilink/bot/sendmessage` | Bearer | Send a text reply |

## Auth headers (POST only)

```
Content-Type: application/json
AuthorizationType: ilink_bot_token
X-WECHAT-UIN: <base64(random uint32 string)>
Authorization: Bearer <bot_token>
```

`X-WECHAT-UIN` is generated once on first run and persisted in `STATE_PATH`.

## getBotQRCode

```
GET /ilink/bot/get_bot_qrcode?bot_type=3
→ { qrcode: "token", qrcode_img_content: "base64..." }
```

The client also accepts `qr_code` / `qrCode` and `qrcode_img` / `qr_img_base64` aliases.

## getQRCodeStatus

```
GET /ilink/bot/get_qrcode_status?qrcode=<token>
→ { status: "waiting" | "scanned" | "confirmed" | "expired" }
```

On `status: "confirmed"` the response includes:

```json
{
  "status": "confirmed",
  "ret": 0,
  "bot_token": "...",
  "baseurl": "https://...",
  "ilink_bot_id": "...",
  "ilink_user_id": "...",
  "route_tag": "..."
}
```

If `ret != 0` the status is treated as `waiting` regardless of the `status` field.

Numeric status values `0/1/2/-1` are also accepted.

## getUpdates

```json
POST /ilink/bot/getupdates
{
  "get_updates_buf": "",
  "base_info": { "channel_version": "kos-weixin/0.1" }
}

→ {
  "ret": 0,
  "msgs": [
    {
      "from_user_id": "xxx@im.wechat",
      "to_user_id": "xxx@im.bot",
      "message_type": 1,
      "message_state": 2,
      "context_token": "...",
      "item_list": [
        { "type": 1, "text_item": { "text": "k hello" } }
      ]
    }
  ],
  "get_updates_buf": "...",
  "longpolling_timeout_ms": 35000
}
```

- `get_updates_buf` is persisted to avoid message replay.
- `ret != 0` is treated as an error.
- Non‑text messages (`message_type != 1`) are ignored by the adapter.

## sendMessage

```json
POST /ilink/bot/sendmessage
{
  "msg": {
    "to_user_id": "<inbound.from_user_id>",
    "message_type": 2,
    "message_state": 2,
    "context_token": "<inbound.context_token>",
    "item_list": [
      { "type": 1, "text_item": { "text": "已记录。" } }
    ]
  },
  "base_info": { "channel_version": "kos-weixin/0.1" }
}
```

`context_token` is **required** — the daemon refuses to reply without it.

## Login flow

```
no botToken
  → GET get_bot_qrcode
  → save QR image to QR_OUTPUT_PATH
  → poll get_qrcode_status every LOGIN_POLL_INTERVAL_MS
  → confirmed → persist credentials → start polling
  → expired  → re‑request QR
  → SIGTERM  → clean exit
```

## Items still to verify with a live gateway

- Exact rate limits and long‑poll timeout values.
- Whether `longpolling_timeout_ms` affects how long `getupdates` blocks.
- Whether QR codes truly expire after ~2 minutes.
- The exact group‑chat detection mechanism (currently `to_user_id` contains `@im.room`).
