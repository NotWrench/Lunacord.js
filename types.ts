// types.ts
import { z } from "zod";

// --- Exception ---

export const ExceptionSchema = z.object({
  message: z.string().nullable(),
  severity: z.enum(["common", "suspicious", "fault"]),
  cause: z.string(),
});

export type Exception = z.infer<typeof ExceptionSchema>;

// --- Track Info ---

export const TrackInfoSchema = z.object({
  identifier: z.string(),
  isSeekable: z.boolean(),
  author: z.string(),
  length: z.number(),
  isStream: z.boolean(),
  position: z.number(),
  title: z.string(),
  uri: z.string().nullable().optional(),
  artworkUrl: z.string().nullable().optional(),
  isrc: z.string().nullable().optional(),
  sourceName: z.string(),
});

export type TrackInfo = z.infer<typeof TrackInfoSchema>;

// --- Track ---

export const TrackSchema = z.object({
  encoded: z.string(),
  info: TrackInfoSchema,
  pluginInfo: z.record(z.string(), z.unknown()).optional(),
  userData: z.record(z.string(), z.unknown()).optional(),
});

export type RawTrack = z.infer<typeof TrackSchema>;

// --- Playlist Info ---

export const PlaylistInfoSchema = z.object({
  name: z.string(),
  selectedTrack: z.number(),
});

export type PlaylistInfo = z.infer<typeof PlaylistInfoSchema>;

// --- Load Result ---

export const LoadResultTrackSchema = z.object({
  loadType: z.literal("track"),
  data: TrackSchema,
});

export const LoadResultPlaylistSchema = z.object({
  loadType: z.literal("playlist"),
  data: z.object({
    info: PlaylistInfoSchema,
    pluginInfo: z.record(z.string(), z.unknown()).optional(),
    tracks: z.array(TrackSchema),
  }),
});

export const LoadResultSearchSchema = z.object({
  loadType: z.literal("search"),
  data: z.array(TrackSchema),
});

export const LoadResultEmptySchema = z.object({
  loadType: z.literal("empty"),
  data: z.object({}).optional(),
});

export const LoadResultErrorSchema = z.object({
  loadType: z.literal("error"),
  data: ExceptionSchema,
});

export const LoadResultSchema = z.discriminatedUnion("loadType", [
  LoadResultTrackSchema,
  LoadResultPlaylistSchema,
  LoadResultSearchSchema,
  LoadResultEmptySchema,
  LoadResultErrorSchema,
]);

export type LoadResult = z.infer<typeof LoadResultSchema>;

// --- Player State ---

export const PlayerStateSchema = z.object({
  time: z.number(),
  position: z.number(),
  connected: z.boolean(),
  ping: z.number(),
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;

// --- Player Update ---

export const PlayerUpdateOpSchema = z.object({
  op: z.literal("playerUpdate"),
  guildId: z.string(),
  state: PlayerStateSchema,
});

export type PlayerUpdate = z.infer<typeof PlayerUpdateOpSchema>;

// --- Stats ---

export const FrameStatsSchema = z.object({
  sent: z.number(),
  nulled: z.number(),
  deficit: z.number(),
});

export type FrameStats = z.infer<typeof FrameStatsSchema>;

export const StatsSchema = z.object({
  op: z.literal("stats"),
  players: z.number(),
  playingPlayers: z.number(),
  uptime: z.number(),
  memory: z.object({
    free: z.number(),
    used: z.number(),
    allocated: z.number(),
    reservable: z.number(),
  }),
  cpu: z.object({
    cores: z.number(),
    systemLoad: z.number(),
    lavalinkLoad: z.number(),
  }),
  frameStats: FrameStatsSchema.nullable().optional(),
});

export type Stats = z.infer<typeof StatsSchema>;

// --- Ready ---

export const ReadyPayloadSchema = z.object({
  op: z.literal("ready"),
  resumed: z.boolean(),
  sessionId: z.string(),
});

export type ReadyPayload = z.infer<typeof ReadyPayloadSchema>;

// --- Track Events ---

export const TrackStartEventSchema = z.object({
  op: z.literal("event"),
  guildId: z.string(),
  type: z.literal("TrackStartEvent"),
  track: TrackSchema,
});

export const TrackEndEventSchema = z.object({
  op: z.literal("event"),
  guildId: z.string(),
  type: z.literal("TrackEndEvent"),
  track: TrackSchema,
  reason: z.string(),
});

export const TrackExceptionEventSchema = z.object({
  op: z.literal("event"),
  guildId: z.string(),
  type: z.literal("TrackExceptionEvent"),
  track: TrackSchema,
  exception: ExceptionSchema,
});

export const TrackStuckEventSchema = z.object({
  op: z.literal("event"),
  guildId: z.string(),
  type: z.literal("TrackStuckEvent"),
  track: TrackSchema,
  thresholdMs: z.number(),
});

export const WebSocketClosedEventSchema = z.object({
  op: z.literal("event"),
  guildId: z.string(),
  type: z.literal("WebSocketClosedEvent"),
  code: z.number(),
  reason: z.string(),
  byRemote: z.boolean(),
});

export const TrackEventSchema = z.discriminatedUnion("type", [
  TrackStartEventSchema,
  TrackEndEventSchema,
  TrackExceptionEventSchema,
  TrackStuckEventSchema,
  WebSocketClosedEventSchema,
]);

export type TrackEvent = z.infer<typeof TrackEventSchema>;

// --- WebSocket Message (top-level discriminated union on `op`) ---

export const WebSocketMessageSchema = z.discriminatedUnion("op", [
  ReadyPayloadSchema,
  PlayerUpdateOpSchema,
  StatsSchema,
  TrackStartEventSchema,
  TrackEndEventSchema,
  TrackExceptionEventSchema,
  TrackStuckEventSchema,
  WebSocketClosedEventSchema,
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// --- Player Update Payload (for REST PATCH) ---

export const PlayerUpdatePayloadSchema = z.object({
  track: z
    .object({
      encoded: z.string().nullable().optional(),
    })
    .optional(),
  position: z.number().optional(),
  endTime: z.number().optional(),
  volume: z.number().optional(),
  paused: z.boolean().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  voice: z
    .object({
      endpoint: z.string(),
      sessionId: z.string(),
      token: z.string(),
    })
    .optional(),
});

export type PlayerUpdatePayload = z.infer<typeof PlayerUpdatePayloadSchema>;
