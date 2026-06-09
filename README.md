# kos / wechat-brain-capture

`kos` is a minimal WeChat remote `k()` daemon. It listens for whitelisted private WeChat text messages, parses `k content` or `记 content`, appends one Markdown line to a fixed local file, and replies in WeChat.

This repository intentionally does **not** depend on OpenClaw runtime, an SDK gateway, LLM calls, shell execution, or a database. The protocol-facing code is isolated in `src/transport` so the iLink / ClawBot details can be adjusted without touching the capture core.

## Current MVP status

Implemented:

- TypeScript / Node.js 20+ daemon layout.
- Config through environment variables and optional `.env`.
- Whitelist enforcement through `ALLOWED_SENDERS`.
- Private-chat-only default behavior.
- `k content`, `记 content`, and `help` parsing.
- Empty capture reply without writing.
- Multi-line capture normalization into one Markdown list item.
- Append-only storage to a configured absolute `BRAIN_LOG_PATH`.
- Local JSON state store for auth/cursor recovery.
- Long-polling loop with per-message failure isolation and exponential backoff.
- Flexible iLink client and WeChat adapter with protocol fields kept configurable.
- systemd service template.
- Unit tests for parser, formatter, storage, handler, and adapter.

Not completed here because it requires live WeChat/iLink credentials and a reachable gateway:

- QR-code or account login flow.
- Real end-to-end `ping -> pong` / `k -> log.md` validation against WeChat.
- Confirmation of final production field names for the exact iLink deployment.

## Commands

```text
k content
记 content
help
```

Examples:

```text
k Today I found a useful idea
记 今天想到一个点
```

The output format is:

```markdown
- YYYY-MM-DD HH:mm:ss [wechat]: content
```

## Security model

The service follows a narrow allow-list model:

- Only sender IDs configured in `ALLOWED_SENDERS` can write.
- Group chats are ignored by default.
- User messages cannot choose paths.
- Only `BRAIN_LOG_PATH` is appended to.
- No shell execution, no `eval`, no LLM routing.
- `BRAIN_LOG_PATH` must be absolute.

## Project structure

```text
src/
  adapter/       WeChat raw-message normalization
  capture/       command parsing, handler, formatter, storage
  transport/     iLink client, poller, auth state
  utils/         logger, time, text normalization

test/            node:test unit tests
docs/            protocol investigation notes
deploy/          systemd template
```

## Local development

```bash
npm install
npm test
npm run lint
npm run build
```

## Runtime configuration

Copy `.env.example` to `.env` for local development, or provide the same variables through systemd.

Required values:

```env
BRAIN_LOG_PATH=/home/your-user/brain/log.md
ALLOWED_SENDERS=wechat-user-id-1,wechat-user-id-2
STATE_PATH=/var/lib/wechat-brain-capture/state.json
ILINK_BASE_URL=https://example-ilink-gateway.local
```

Optional values:

```env
TIMEZONE=Asia/Shanghai
LOG_LEVEL=info
ILINK_GET_UPDATES_PATH=/api/getUpdates
ILINK_SEND_MESSAGE_PATH=/api/sendMessage
ILINK_AUTH_TOKEN=
ILINK_UIN=
ILINK_REQUEST_TIMEOUT_MS=65000
POLLER_MIN_BACKOFF_MS=1000
POLLER_MAX_BACKOFF_MS=30000
```

## Deployment sketch

```bash
npm install
npm run build
sudo useradd --system --home /var/lib/wechat-brain-capture --shell /usr/sbin/nologin wechat-brain
sudo mkdir -p /var/lib/wechat-brain-capture
sudo chown -R wechat-brain:wechat-brain /var/lib/wechat-brain-capture
sudo cp deploy/wechat-brain-capture.service /etc/systemd/system/wechat-brain-capture.service
sudo systemctl daemon-reload
sudo systemctl enable --now wechat-brain-capture
```

Adjust the service file paths before installing it.

## Protocol integration notes

The iLink / ClawBot request and response shapes are deliberately normalized through:

- `src/transport/ilink-client.ts`
- `src/adapter/wechat-message.ts`
- `docs/protocol-notes.md`

When the live gateway is available, first confirm:

1. Auth token and `uin` acquisition / refresh fields.
2. `getUpdates` request body and cursor field name.
3. Text message item shape.
4. `sendMessage` body fields for private chat reply.

Only the transport/adapter layer should need changes after that confirmation.
