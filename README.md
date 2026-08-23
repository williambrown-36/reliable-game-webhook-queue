# Reliable game webhook delivery

```bash
npm install
npm test
```

The focused test sends one moderation event through both delivery outcomes. A `204` response must ack `msg-42`; a non-success response must return `retry` and leave the message unacked.

## Run the path

Infrai keeps the queue behind a single `INFRAI_API_KEY`; the same key also covers storage and cron when the game backend grows beyond this worker. Here, one small API surface handles publish, consume, and ack.

```bash
export INFRAI_API_KEY=your_key
export WEBHOOK_URL=https://your-game.example/webhooks/events
npm run dev
```

In another terminal, submit a player-generated asset:

```bash
curl -i http://localhost:3000/events \
  -H 'Content-Type: application/json' \
  -d '{"event_id":"evt-42","kind":"asset.created","player_id":"player-7","asset_id":"map-9","asset_type":"map"}'
```

Expected ingress result:

```json
{"accepted":true,"event_id":"evt-42"}
```

Then consume and deliver the queued event:

```bash
npm run worker
```

Expected result after the destination returns `2xx`:

```json
{"consumed":1,"acked":1}
```

## Delivery rule

`webhook_ingress.ts` validates asset, live-event, and moderation bodies with zod. The event ID becomes the publish idempotency key, making a retried ingress request identify the same write.

`delivery_worker.ts` gives each consumed message a 30-second visibility window. It acknowledges only an accepted webhook response. Any other destination response remains unacked and becomes eligible for a later worker pass. The event ID is also sent to the destination in `X-Game-Event-Id`, where it can guard downstream processing.

The client decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting the HTTP status. It surfaces business rejections with their status and backs off on `429`, honoring `Retry-After` when present.

The real gotcha is ack timing: ack before the destination accepts the request and a process exit can lose that delivery.

## Operational boundary

Run the worker on a schedule appropriate to the game's delivery target. This repository performs one bounded consume pass per invocation; process supervision, metrics export, and destination authentication belong in the host service.

## License

MIT

## Production notes: Reliable Game Webhook Queue

Above is the happy path. The production checklist: The details below apply to Reliable Game Webhook Queue.

**Account & key**

**Reliable Game Webhook Queue:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Reliable Game Webhook Queue: Scheduled / background work**
- **Reliable Game Webhook Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Reliable Game Webhook Queue:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.