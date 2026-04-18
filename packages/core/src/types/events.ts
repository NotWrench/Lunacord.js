import type { z } from "zod";
import type {
  TrackEndEventSchema,
  TrackEventSchema,
  TrackExceptionEventSchema,
  TrackStartEventSchema,
  TrackStuckEventSchema,
  WebSocketClosedEventSchema,
  WebSocketMessageSchema,
} from "../schemas/lavalink";

export type TrackStartEvent = z.infer<typeof TrackStartEventSchema>;
export type TrackEndEvent = z.infer<typeof TrackEndEventSchema>;
export type TrackExceptionEvent = z.infer<typeof TrackExceptionEventSchema>;
export type TrackStuckEvent = z.infer<typeof TrackStuckEventSchema>;
export type WebSocketClosedEvent = z.infer<typeof WebSocketClosedEventSchema>;
export type TrackEvent = z.infer<typeof TrackEventSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

/** Scope of a unified debug log line. */
export type DebugScope = "node" | "ws" | "rest" | "plugin" | "player" | "voice" | "manager";

export interface DebugEvent {
  data?: unknown;
  message: string;
  /**
   * Optional node id when the message originates from a specific Lavalink node. Kept as a
   * string (not a `Node` ref) so `DebugEvent` can be JSON-serialised cheaply.
   */
  nodeId?: string;
  scope: DebugScope;
}
