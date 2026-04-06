// index.ts

// Classes
export {
  type CreatePlayerOptions,
  Lunacord,
  LunacordError,
  type LunacordNodeSelectionStrategy,
  type LunacordPlugin,
  type LunacordPluginEvent,
} from "./core/Lunacord";
export { Node } from "./core/Node";
export {
  BASSBOOST_FILTERS,
  KARAOKE_FILTERS,
  NIGHTCORE_FILTERS,
  Player,
  VAPORWAVE_FILTERS,
} from "./core/Player";
// Errors
export {
  LavalinkRestError,
  Rest,
  type RestErrorContext,
  type RestMiddleware,
  type RestRequestContext,
  type RestRequestPatch,
  type RestResponseContext,
  ValidationError,
} from "./rest/Rest";
export { Queue, type QueueRemoveDuplicateOptions } from "./structures/Queue";
export type { SearchResult } from "./structures/SearchResult";
export { Track } from "./structures/Track";
// Types (re-export)
export type {
  Exception,
  Filters,
  FrameStats,
  InfoResponse,
  LoadResult,
  PlayerState,
  PlayerUpdate,
  PlayerUpdatePayload,
  PlaylistInfo,
  RawTrack,
  ReadyPayload,
  RoutePlannerStatus,
  Stats,
  TrackEvent,
  TrackInfo,
  VersionResponse,
  WebSocketMessage,
} from "./types";
// Zod schemas (for consumers who want to validate themselves)
export {
  buildSearchIdentifier,
  DEFAULT_SEARCH_PROVIDER,
  ExceptionSchema,
  FrameStatsSchema,
  InfoResponseSchema,
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
  RoutePlannerStatusSchema,
  SearchProvider,
  StatsSchema,
  TrackEndEventSchema,
  TrackEventSchema,
  TrackExceptionEventSchema,
  TrackInfoSchema,
  TrackSchema,
  TrackStartEventSchema,
  TrackStuckEventSchema,
  VersionResponseSchema,
  WebSocketClosedEventSchema,
  WebSocketMessageSchema,
} from "./types";
export { TypedEventEmitter } from "./utils/EventEmitter";
export { Socket } from "./websocket/Socket";
