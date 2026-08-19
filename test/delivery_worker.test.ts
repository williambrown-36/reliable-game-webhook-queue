import { describe, expect, it, vi } from "vitest";
import { deliverOne } from "../src/delivery_worker.js";

const message = {
  message_id: "msg-42",
  payload: {
    event_id: "evt-42",
    kind: "moderation.queued",
    player_id: "player-7",
    moderation_item_id: "item-9",
    priority: "urgent",
  },
};

describe("webhook delivery decision", () => {
  it("acks only after the destination accepts the event", async () => {
    const ack = vi.fn(async () => undefined);
    const accepted = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(deliverOne({ ack }, message, "https://hooks.example.test/game", accepted)).resolves.toBe("acked");
    expect(ack).toHaveBeenCalledWith("msg-42");

    ack.mockClear();
    const rejected = vi.fn(async () => new Response(null, { status: 503 }));
    await expect(deliverOne({ ack }, message, "https://hooks.example.test/game", rejected)).resolves.toBe("retry");
    expect(ack).not.toHaveBeenCalled();
  });
});
