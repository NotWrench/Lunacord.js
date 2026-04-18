// ===== Primary surface =====

// ===== Builders =====
export { LunacordBuilder } from "./builders/LunacordBuilder";
export type { NodeBuilderStart } from "./builders/NodeBuilder";
export { NodeBuilder } from "./builders/NodeBuilder";
export type { PlayerBuilderStart } from "./builders/PlayerBuilder";
export { PlayerBuilder } from "./builders/PlayerBuilder";
export { PluginBuilder } from "./builders/PluginBuilder";
// ===== Cache =====
export { Cache } from "./cache/Cache";
export { CacheManager } from "./cache/CacheManager";
export { MemoryCacheStore } from "./cache/stores/MemoryCacheStore";
export { NoopCacheStore } from "./cache/stores/NoopCacheStore";
export type {
  CacheEntry,
  CacheNamespaceOptions,
  CacheOptions,
  CacheSetOptions,
  CacheStore,
  MemoryCacheOptions,
} from "./cache/types";
export { buildTrackCacheKey } from "./cache/utils";
export type {
  AggregatedLunacordStats,
  AggregatedNodeStats,
  AutoMigrateOptions,
  CreatePlayerOptions,
  LunacordEvents,
  LunacordLogger,
  LunacordNodeOptions,
  LunacordNodeSelectionStrategy,
  LunacordOptions,
} from "./core/Lunacord";
export { Lunacord, LunacordError } from "./core/Lunacord";
export type {
  GatewayVoiceStatePayload,
  NodeDebugEvent,
  NodeEvents,
  NodeOptions,
  NodeWsEvent,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
  VoiceConnectOptions,
  VoiceSocketClosedEvent,
} from "./core/Node";
// ===== Node + Player =====
export { Node } from "./core/Node";
export type {
  PlayerActionEvent,
  PlayerExportData,
  PlayerOptions,
} from "./core/Player";
export { Player } from "./core/Player";
// ===== Domain =====
export {
  BASSBOOST_FILTERS,
  Filter,
  FilterBuilder,
  KARAOKE_FILTERS,
  NIGHTCORE_FILTERS,
  VAPORWAVE_FILTERS,
} from "./domain/filter/Filter";
export { Queue } from "./domain/queue/Queue";
export { QueueHistory } from "./domain/queue/QueueHistory";
export type { SearchResult } from "./domain/track/SearchResult";
export { toSearchResult } from "./domain/track/SearchResult";
export { Track } from "./domain/track/Track";
// ===== Errors =====
export * from "./errors";
// ===== Persistence =====
export { MemoryPersistenceAdapter } from "./persistence/MemoryPersistenceAdapter";
export type {
  PersistenceAdapter,
  PlayerPersistenceSnapshot,
} from "./persistence/PersistenceAdapter";
export { PluginManager } from "./plugins/runtime/PluginManager";
export type {
  LunacordPlugin,
  LunacordPluginEvent,
  PluginApiVersion,
  PluginCommand,
  PluginContext,
  PluginDependency,
  PluginErrorEvent,
  PluginHookName,
  PluginHookTimeouts,
  PluginLogger,
  PluginMetadata,
  PluginMetric,
  PluginRestErrorHookContext,
  PluginRestRequestContext,
  PluginRestResponseContext,
  PluginSearchResultContext,
} from "./plugins/types";
// ===== Plugins =====
export {
  LUNACORD_PLUGIN_API_VERSION,
  LUNACORD_PLUGIN_SUPPORTED_API_VERSIONS,
} from "./plugins/types";
// ===== Zod schemas (Lavalink v4) =====
export * from "./schemas/lavalink";
export type {
  RestErrorContext,
  RestMiddleware,
  RestOptions,
  RestRequestContext,
  RestRequestPatch,
  RestResponseContext,
} from "./transports/rest/Rest";
// ===== Transports =====
export { LavalinkRestError, Rest, ValidationError } from "./transports/rest/Rest";
export type { WebSocketFactory, WebSocketFactoryContext } from "./transports/websocket/Socket";
export { Socket } from "./transports/websocket/Socket";
export type {
  DebugEvent,
  DebugScope,
  TrackEndEvent,
  TrackEvent,
  TrackExceptionEvent,
  TrackStartEvent,
  TrackStuckEvent,
  WebSocketClosedEvent,
  WebSocketMessage,
} from "./types/events";
// ===== Types =====
export type {
  ChannelMixFilter,
  DistortionFilter,
  EqualizerBand,
  Filters,
  KaraokeFilter,
  LowPassFilter,
  RotationFilter,
  TimescaleFilter,
  TremoloFilter,
  VibratoFilter,
} from "./types/filters";
export type {
  Exception,
  FrameStats,
  GitObject,
  InfoResponse,
  LoadResult,
  LoadResultEmpty,
  LoadResultError,
  LoadResultPlaylist,
  LoadResultSearch,
  LoadResultTrack,
  PlayerState,
  PlayerUpdate,
  PlayerUpdatePayload,
  PlaylistInfo,
  PluginObject,
  RawTrack,
  ReadyPayload,
  RoutePlannerDetails,
  RoutePlannerFailingAddress,
  RoutePlannerIpBlock,
  RoutePlannerStatus,
  Session,
  Stats,
  TrackInfo,
  VersionObject,
  VersionResponse,
} from "./types/load";
export type {
  GeniusOptions,
  Lyrics,
  LyricsOptions,
  LyricsProvider,
  LyricsRequestOptions,
  LyricsResult,
  LyricsUnavailableReason,
} from "./types/lyrics";
export type { SearchProviderInput } from "./types/search";
export {
  buildProviderSequence,
  buildSearchIdentifier,
  DEFAULT_FALLBACK_PROVIDERS,
  DEFAULT_SEARCH_PROVIDER,
  detectProviderFromUrl,
  SearchProvider,
  tryParseHttpUrl,
} from "./types/search";
export type { VoiceConnectionState, VoiceState, VoiceStateSnapshot } from "./types/voice";
// ===== Utilities =====
export { TypedEventEmitter } from "./utils/EventEmitter";
