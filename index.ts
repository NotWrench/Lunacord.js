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
export { Player } from "./core/Player";
export { GeniusClient } from "./lyrics/GeniusClient";
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
export {
  BASSBOOST_FILTERS,
  Filter,
  KARAOKE_FILTERS,
  NIGHTCORE_FILTERS,
  VAPORWAVE_FILTERS,
} from "./structures/Filter";
export { Queue, type QueueRemoveDuplicateOptions } from "./structures/Queue";
export type { SearchResult } from "./structures/SearchResult";
export { Track } from "./structures/Track";
// Types (re-export)
export type {
  Exception,
  Filters,
  FrameStats,
  GeniusOptions,
  InfoResponse,
  LoadResult,
  Lyrics,
  LyricsRequestOptions,
  LyricsResult,
  LyricsUnavailableReason,
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
  LyricsSchema,
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
