import { gameEventSchema, type GameEvent } from "./game_event.js";
import { queueFromEnvironment, type InfraiQueue, type QueuedMessage } from "./infrai_queue.js";

export async function deliverOne(
  queue: Pick<InfraiQueue, "ack">,
  message: QueuedMessage,
  destination: string,
  fetcher: typeof fetch = fetch,
): Promise<"acked" | "retry"> {
  const event: GameEvent = gameEventSchema.parse(message.payload);
  const response = await fetcher(destination, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Game-Event-Id": event.event_id,
    },
    body: JSON.stringify(event),
  });

  if (response.status < 200 || response.status >= 300) return "retry";
  await queue.ack(message.message_id);
  return "acked";
}

async function run(): Promise<void> {
  const destination = process.env.WEBHOOK_URL;
  if (!destination) throw new Error("WEBHOOK_URL is required");
  const queue = queueFromEnvironment();
  const messages = await queue.consume(10, 30);
  const results = await Promise.all(messages.map((message) => deliverOne(queue, message, destination)));
  console.log(JSON.stringify({ consumed: messages.length, acked: results.filter((r) => r === "acked").length }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
