# kos / wechat-brain-capture

`kos` is a minimal WeChat personal brain-capture daemon.  Every text message
you send from WeChat is automatically appended as a Markdown line to a local
`log.md` — no prefix needed, just talk.

It uses the iLink Bot API (`https://ilinkai.weixin.qq.com/ilink/bot/*`), the
same protocol behind the official `@tencent-weixin/openclaw-weixin` package.
No OpenClaw runtime, no SDK gateway, no LLM calls, no database.

## Quick start

```bash
cp .env.example .env
# 1. Set BRAIN_LOG_PATH and ALLOWED_SENDERS (leave WEIXIN_BOT_TOKEN empty)
# 2. WEIXIN_BASE_URL defaults to https://ilinkai.weixin.qq.com

npm install
npm run build
npm start
```

On first run (no saved bot token) the daemon:

1. Fetches a QR code from `GET /ilink/bot/get_bot_qrcode?bot_type=3`
2. **Displays the QR code directly in the terminal** (Unicode blocks)
3. Also saves a PNG backup to `QR_OUTPUT_PATH` (default `/tmp/kos-qr.png`)
4. Polls `GET /ilink/bot/get_qrcode_status?qrcode=...` every 2 s
5. On confirmed → persists `botToken`, `botId`, `userId`, `baseUrl` to `STATE_PATH`
6. Starts long‑polling `POST /ilink/bot/getupdates`

From then on, **any text message** you send in the private chat is captured:

```markdown
- YYYY-MM-DD HH:mm:ss [wechat]: your message here
```

To discover your WeChat user ID for `ALLOWED_SENDERS`, check the debug logs after
sending your first message — the `senderId` field is your `xxx@im.wechat` ID.

## Configuration

```env
BRAIN_LOG_PATH=/home/your-user/brain/log.md
ALLOWED_SENDERS=xxx@im.wechat,another@im.wechat
STATE_PATH=/var/lib/wechat-brain-capture/state.json
WEIXIN_BASE_URL=https://ilinkai.weixin.qq.com

# Optional — pre‑fill to skip QR login
WEIXIN_BOT_TOKEN=
WEIXIN_BOT_ID=
WEIXIN_USER_ID=
WEIXIN_ROUTE_TAG=

LOG_LEVEL=info
TIMEZONE=Asia/Shanghai
LOGIN_POLL_INTERVAL_MS=2000
QR_OUTPUT_PATH=/tmp/kos-qr.png
WEIXIN_REQUEST_TIMEOUT_MS=65000
POLLER_MIN_BACKOFF_MS=1000
POLLER_MAX_BACKOFF_MS=30000
```

## Project structure

```
src/
  adapter/       InboundMsg → IncomingTextMessage normalization
  capture/       Parser, handler, formatter, file storage
  transport/     WeixinClient (QR login + getUpdates + sendMessage),
                 Poller, auth loader, JSON state store
  utils/         Logger, timezone, text normalization, X-WECHAT-UIN
```

## Deployment

```bash
npm install && npm run build
sudo useradd --system --home /var/lib/wechat-brain-capture \
  --shell /usr/sbin/nologin wechat-brain
sudo mkdir -p /var/lib/wechat-brain-capture
sudo chown -R wechat-brain:wechat-brain /var/lib/wechat-brain-capture
sudo cp deploy/wechat-brain-capture.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wechat-brain-capture
```

## Security

- Only `ALLOWED_SENDERS` can write.
- Group chats are ignored (`to_user_id` matches `@im.room` or starts with `@@`).
- User messages cannot choose paths; only `BRAIN_LOG_PATH` is appended to.
- No shell execution, no `eval`, no LLM routing.

## Acknowledgements

The iLink Bot API protocol was reverse‑engineered and documented by the
open‑source community.  This project's transport layer is informed by:

- [`@tencent-weixin/openclaw-weixin`](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin) — official npm package (TypeScript source)
- [`hao-ji-xing/openclaw-weixin`](https://github.com/hao-ji-xing/openclaw-weixin) — community protocol analysis and documentation
- [`hao-ji-xing/cc-weixin`](https://github.com/hao-ji-xing/cc-weixin) — standalone iLink bot reference implementation

微信 iLink Bot API 是腾讯官方产品，受《微信 ClawBot 功能使用条款》约束。
