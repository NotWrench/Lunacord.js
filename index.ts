// index.ts

export { Cache } from "./cache/Cache";
export { CacheManager } from "./cache/CacheManager";
export { MemoryCacheStore } from "./cache/stores/MemoryCacheStore";
export { NoopCacheStore } from "./cache/stores/NoopCacheStore";
export type {
  CacheEntry,
  CacheNamespaceOptions,
  CacheOptions,
  CacheResolver,
  CacheSetOptions,
  CacheStore,
} from "./cache/types";
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
export { LyricsClient } from "./lyrics/LyricsClient";
export { LyricsOvhClient } from "./lyrics/LyricsOvhClient";
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
  LyricsOptions,
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
  SearchProviderInput,
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
export {
  Socket,
  type WebSocketFactory,
  type WebSocketFactoryContext,
} from "./websocket/Socket";
