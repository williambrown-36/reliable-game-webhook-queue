import { z } from "zod";

export const gameEventSchema = z.discriminatedUnion("kind", [
  z.object({
    event_id: z.string().min(1),
    kind: z.literal("asset.created"),
    player_id: z.string().min(1),
    asset_id: z.string().min(1),
    asset_type: z.enum(["map", "skin", "emblem"]),
  }),
  z.object({
    event_id: z.string().min(1),
    kind: z.literal("live_event.started"),
    player_id: z.string().min(1),
    live_event_id: z.string().min(1),
  }),
  z.object({
    event_id: z.string().min(1),
    kind: z.literal("moderation.queued"),
    player_id: z.string().min(1),
    moderation_item_id: z.string().min(1),
    priority: z.enum(["normal", "urgent"]),
  }),
]);

export type GameEvent = z.infer<typeof gameEventSchema>;
