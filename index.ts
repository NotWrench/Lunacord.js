// index.ts

// Classes
export { Node } from "./core/Node.ts";
export { Player } from "./core/Player.ts";
// Errors
export { LavalinkRestError, Rest, ValidationError } from "./rest/Rest.ts";
export { Queue } from "./structures/Queue.ts";
export type { SearchResult } from "./structures/SearchResult.ts";
export { Track } from "./structures/Track.ts";
// Types (re-export)
export type {
  Exception,
  FrameStats,
  LoadResult,
  PlayerState,
  PlayerUpdate,
  PlayerUpdatePayload,
  PlaylistInfo,
  RawTrack,
  ReadyPayload,
  Stats,
  TrackEvent,
  TrackInfo,
  WebSocketMessage,
} from "./types.ts";
// Zod schemas (for consumers who want to validate themselves)
export {
  buildSearchIdentifier,
  DEFAULT_SEARCH_PROVIDER,
  ExceptionSchema,
  FrameStatsSchema,
  LoadResultEmptySchema,
  LoadResultErrorSchema,
  LoadResultPlaylistSchema,
  LoadResultSchema,
  LoadResultSearchSchema,
  LoadResultTrackSchema,
  PlayerStateSchema,
  PlayerUpdateOpSchema,
  PlayerUpdatePayloadSchema,
  PlaylistInfoSchema,
  ReadyPayloadSchema,
  SearchProvider,
  StatsSchema,
  TrackEndEventSchema,
  TrackEventSchema,
  TrackExceptionEventSchema,
  TrackInfoSchema,
  TrackSchema,
  TrackStartEventSchema,
  TrackStuckEventSchema,
  WebSocketClosedEventSchema,
  WebSocketMessageSchema,
} from "./types.ts";
export { TypedEventEmitter } from "./utils/EventEmitter.ts";
export { Socket } from "./websocket/Socket.ts";
