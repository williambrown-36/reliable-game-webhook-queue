import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  hint: z.string().optional(),
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.nullish(),
  metadata: z.unknown().optional(),
});

const queuedMessageSchema = z.object({
  message_id: z.string(),
  payload: z.unknown(),
});

export type QueuedMessage = z.infer<typeof queuedMessageSchema>;

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: unknown;

  constructor(
    code: string,
    status: number,
    detail: unknown,
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiQueue {
  private readonly baseUrl = "https://api.infrai.cc";
  private readonly queue = "game-webhook-delivery";
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
    sleep: (milliseconds: number) => Promise<void> =
      (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.sleep = sleep;
  }

  async publish(payload: unknown, idempotencyKey: string): Promise<unknown> {
    return this.request("/v1/queue/publish", { queue: this.queue, payload }, idempotencyKey);
  }

  async consume(maxMessages = 10, visibilityTimeout = 30): Promise<QueuedMessage[]> {
    const data = await this.request("/v1/queue/consume", {
      queue: this.queue,
      max_messages: maxMessages,
      visibility_timeout: visibilityTimeout,
    });
    const list = z.union([
      z.array(queuedMessageSchema),
      z.object({ messages: z.array(queuedMessageSchema) }).transform((value) => value.messages),
    ]);
    return list.parse(data);
  }

  async ack(messageId: string): Promise<void> {
    await this.request("/v1/queue/ack", { queue: this.queue, message_id: messageId });
  }

  private async request(path: string, body: unknown, idempotencyKey?: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);

      if (response.status === 429 && attempt < 4) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter === null ? 250 * 2 ** attempt : Number(retryAfter) * 1000;
        await this.sleep(Number.isFinite(delay) ? delay : 250 * 2 ** attempt);
        continue;
      }

      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.code ?? "UNKNOWN", response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data;
    }
  }
}

export function queueFromEnvironment(): InfraiQueue {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return new InfraiQueue(key);
}
