# kos / wechat-brain-capture

`kos` is a minimal WeChat personal bot daemon.  It uses the iLink Bot API
(`https://ilinkai.weixin.qq.com/ilink/bot/*`) to scan a QR code, receive
private text messages, parse `k content` / `记 content` commands, and
append Markdown lines to a local file.

No OpenClaw runtime, no SDK gateway, no LLM calls, no database.

## Quick start

```bash
cp .env.example .env
# 1. Set WEIXIN_BASE_URL (default https://ilinkai.weixin.qq.com)
# 2. Set BRAIN_LOG_PATH and ALLOWED_SENDERS
# 3. Leave WEIXIN_BOT_TOKEN empty to trigger QR login

npm install
npm run build
npm start
```

On first run (no saved bot token) the daemon:

1. Calls `GET /ilink/bot/get_bot_qrcode?bot_type=3`
2. Saves the QR image to `QR_OUTPUT_PATH` (default `/tmp/kos-qr.png`)
3. Polls `GET /ilink/bot/get_qrcode_status?qrcode=...` every 2 s
4. On confirmed → saves `botToken`, `botId`, `userId`, `baseUrl` to `STATE_PATH`
5. Starts long‑polling `POST /ilink/bot/getupdates`

## Commands

```text
k content
记 content
help
```

Reply format:

```markdown
- YYYY-MM-DD HH:mm:ss [wechat]: content
```

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
  capture/       Command parser, handler, formatter, file storage
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
- User messages cannot choose paths.
- Only `BRAIN_LOG_PATH` is appended to.
- No shell execution, no `eval`, no LLM routing.
