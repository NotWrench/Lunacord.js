// types.ts
import { z } from "zod";

export enum SearchProvider {
  YouTube = "ytsearch",
  YouTubeMusic = "ytmsearch",
  SoundCloud = "scsearch",
  Spotify = "spsearch",
  Deezer = "dzsearch",
  AppleMusic = "amsearch",
}

export type SearchProviderInput = SearchProvider | string;

export const DEFAULT_SEARCH_PROVIDER = SearchProvider.YouTube;

export const buildSearchIdentifier = (
  query: string,
  provider: SearchProviderInput = DEFAULT_SEARCH_PROVIDER
): string => `${provider}:${query}`;

// --- Exception ---

export const ExceptionSchema = z.object({
  message: z.string().nullable(),
  severity: z.enum(["common", "suspicious", "fault"]),
  cause: z.string(),
  causeStackTrace: z.string().nullable().optional(),
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

// --- Lyrics ---

export interface GeniusOptions {
  accessToken: string;
  clientId: string;
  clientSecret: string;
  requestTimeoutMs?: number;
}

export interface LyricsOptions {
  genius?: GeniusOptions;
  requestTimeoutMs?: number;
}

export const LyricsSchema = z.object({
  title: z.string(),
  artist: z.string(),
  url: z.string(),
  lyricsText: z.string(),
  syncedLyrics: z
    .array(
      z.object({
        timeMs: z.number(),
        text: z.string(),
      })
    )
    .optional(),
  albumArtUrl: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  geniusId: z.number().optional(),
});

export type Lyrics = z.infer<typeof LyricsSchema>;

export interface LyricsRequestOptions {
  query?: string;
}

export type LyricsUnavailableReason =
  | "invalid_token"
  | "missing_credentials"
  | "provider_unavailable"
  | "rate_limited"
  | "unsupported";

export type LyricsResult =
  | {
      lyrics: Lyrics;
      status: "found";
    }
  | {
      status: "not_found";
    }
  | {
      status: "no_track";
    }
  | {
      reason: LyricsUnavailableReason;
      status: "unavailable";
    };

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
  reason: z.enum(["finished", "loadFailed", "stopped", "replaced", "cleanup"]),
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

// --- WebSocket Message (top-level union on `op`) ---

export const WebSocketMessageSchema = z.union([
  ReadyPayloadSchema,
  PlayerUpdateOpSchema,
  StatsSchema,
  TrackEventSchema,
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// --- Voice State ---

export const VoiceStateSchema = z.object({
  token: z.string(),
  endpoint: z.string(),
  sessionId: z.string(),
});

export type VoiceState = z.infer<typeof VoiceStateSchema>;

// --- Filters ---

export const EqualizerBandSchema = z.object({
  band: z.number(),
  gain: z.number(),
});

export const KaraokeFilterSchema = z.object({
  level: z.number().optional(),
  monoLevel: z.number().optional(),
  filterBand: z.number().optional(),
  filterWidth: z.number().optional(),
});

export const TimescaleFilterSchema = z.object({
  speed: z.number().optional(),
  pitch: z.number().optional(),
  rate: z.number().optional(),
});

export const TremoloFilterSchema = z.object({
  frequency: z.number().optional(),
  depth: z.number().optional(),
});

export const VibratoFilterSchema = z.object({
  frequency: z.number().optional(),
  depth: z.number().optional(),
});

export const RotationFilterSchema = z.object({
  rotationHz: z.number().optional(),
});

export const DistortionFilterSchema = z.object({
  sinOffset: z.number().optional(),
  sinScale: z.number().optional(),
  cosOffset: z.number().optional(),
  cosScale: z.number().optional(),
  tanOffset: z.number().optional(),
  tanScale: z.number().optional(),
  offset: z.number().optional(),
  scale: z.number().optional(),
});

export const ChannelMixFilterSchema = z.object({
  leftToLeft: z.number().optional(),
  leftToRight: z.number().optional(),
  rightToLeft: z.number().optional(),
  rightToRight: z.number().optional(),
});

export const LowPassFilterSchema = z.object({
  smoothing: z.number().optional(),
});

export const FiltersSchema = z.object({
  volume: z.number().optional(),
  equalizer: z.array(EqualizerBandSchema).optional(),
  karaoke: KaraokeFilterSchema.optional(),
  timescale: TimescaleFilterSchema.optional(),
  tremolo: TremoloFilterSchema.optional(),
  vibrato: VibratoFilterSchema.optional(),
  rotation: RotationFilterSchema.optional(),
  distortion: DistortionFilterSchema.optional(),
  channelMix: ChannelMixFilterSchema.optional(),
  lowPass: LowPassFilterSchema.optional(),
  pluginFilters: z.record(z.string(), z.unknown()).optional(),
});

export type Filters = z.infer<typeof FiltersSchema>;

// --- Player Update Payload (for REST PATCH) ---

export const PlayerUpdatePayloadSchema = z.object({
  track: z
    .object({
      encoded: z.string().nullable().optional(),
      identifier: z.string().optional(),
      userData: z.record(z.string(), z.unknown()).optional(),
    })
    .nullable()
    .optional(),
  position: z.number().optional(),
  endTime: z.number().optional(),
  volume: z.number().optional(),
  paused: z.boolean().optional(),
  filters: FiltersSchema.optional(),
  voice: z
    .object({
      channelId: z.string(),
      endpoint: z.string(),
      sessionId: z.string(),
      token: z.string(),
    })
    .optional(),
});

export type PlayerUpdatePayload = z.infer<typeof PlayerUpdatePayloadSchema>;

// --- Player API Models ---

export const PlayerSchema = z.object({
  guildId: z.string(),
  track: TrackSchema.nullable().optional(),
  volume: z.number(),
  paused: z.boolean(),
  state: PlayerStateSchema,
  voice: VoiceStateSchema,
  filters: FiltersSchema,
});

export type Player = z.infer<typeof PlayerSchema>;

// --- Session API Models ---

export const SessionSchema = z.object({
  resuming: z.boolean(),
  timeout: z.number(),
});

export type Session = z.infer<typeof SessionSchema>;

// --- Info API Models ---

export const VersionObjectSchema = z.object({
  semver: z.string(),
  major: z.number(),
  minor: z.number(),
  patch: z.number(),
  preRelease: z.string().nullable().optional(),
  build: z.string().nullable().optional(),
});
export const VersionResponseSchema = z.string();
export type VersionResponse = z.infer<typeof VersionResponseSchema>;

export const GitObjectSchema = z.object({
  branch: z.string(),
  commit: z.string(),
  commitTime: z.number(),
});

export const PluginObjectSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const InfoResponseSchema = z.object({
  version: VersionObjectSchema,
  buildTime: z.number(),
  git: GitObjectSchema,
  jvm: z.string(),
  lavaplayer: z.string(),
  sourceManagers: z.array(z.string()),
  filters: z.array(z.string()),
  plugins: z.array(PluginObjectSchema),
});

export type InfoResponse = z.infer<typeof InfoResponseSchema>;

// --- RoutePlanner API Models ---

export const RoutePlannerIpBlockSchema = z.object({
  type: z.enum(["Inet4Address", "Inet6Address"]),
  size: z.string(),
});

export const RoutePlannerFailingAddressSchema = z.object({
  failingAddress: z.string(),
  failingTimestamp: z.number(),
  failingTime: z.string(),
});

export const RoutePlannerDetailsSchema = z.object({
  ipBlock: RoutePlannerIpBlockSchema,
  failingAddresses: z.array(RoutePlannerFailingAddressSchema),
  blockIndex: z.string().optional(),
  currentAddressIndex: z.string().optional(),
});

export const RoutePlannerStatusSchema = z.object({
  class: z
    .enum([
      "RotatingIpRoutePlanner",
      "NanoIpRoutePlanner",
      "RotatingNanoIpRoutePlanner",
      "BalancingIpRoutePlanner",
    ])
    .nullable(),
  details: RoutePlannerDetailsSchema.nullable().optional(),
});

export type RoutePlannerStatus = z.infer<typeof RoutePlannerStatusSchema>;
