import { createServer } from "node:http";
import { gameEventSchema } from "./game_event.js";
import { InfraiError, queueFromEnvironment } from "./infrai_queue.js";

const queue = queueFromEnvironment();
const port = Number(process.env.PORT ?? "3000");

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/events") {
    response.writeHead(404).end();
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const event = gameEventSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    await queue.publish(event, `game-event:${event.event_id}`);
    response.writeHead(202, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ accepted: true, event_id: event.event_id }));
  } catch (error) {
    const status = error instanceof InfraiError && error.status < 500 ? error.status : 400;
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ accepted: false }));
  }
}).listen(port, () => console.log(`webhook ingress listening on :${port}`));
