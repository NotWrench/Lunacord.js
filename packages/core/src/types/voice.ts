import type { z } from "zod";
import type { VoiceStateSchema } from "../schemas/lavalink";

export type VoiceState = z.infer<typeof VoiceStateSchema>;

/** Observable voice-connection state of a Player. */
export type VoiceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "resuming";

export interface VoiceStateSnapshot {
  channelId?: string;
  endpoint?: string;
  sessionId?: string;
  token?: string;
}
