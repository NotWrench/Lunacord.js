import type { Cache } from "../cache/Cache";
import type { LunacordEvents } from "../core/Lunacord";
import type { Node } from "../core/Node";
import type { Player } from "../core/Player";
import type { SearchResult } from "../domain/track/SearchResult";
import type {
  RestErrorContext,
  RestRequestContext,
  RestRequestPatch,
  RestResponseContext,
} from "../transports/rest/Rest";
import type { SearchProviderInput } from "../types";
import type { TypedEventEmitter } from "../utils/EventEmitter";

export const LUNACORD_PLUGIN_API_VERSION = "2" as const;

/** Historically supported API versions. `"1"` is accepted with a deprecation warning. */
export const LUNACORD_PLUGIN_SUPPORTED_API_VERSIONS = ["1", "2"] as const;

export type PluginApiVersion = (typeof LUNACORD_PLUGIN_SUPPORTED_API_VERSIONS)[number];
export type MaybePromise<T> = Promise<T> | T;

export type LunacordPluginEvent = {
  [K in keyof LunacordEvents]: { type: K } & LunacordEvents[K];
}[keyof LunacordEvents];

export interface PluginDependency {
  name: string;
  version?: string;
}

export interface PluginMetadata {
  readonly apiVersion: string;
  readonly capabilities?: readonly string[];
  readonly dependencies?: readonly PluginDependency[];
  readonly name: string;
  readonly timeouts?: PluginHookTimeouts;
  readonly version: string;
}

export interface PluginCommand {
  description?: string;
  name: string;
}

export interface PluginMetric {
  collect?: () => MaybePromise<number>;
  description?: string;
  name: string;
}

export interface PluginLogger {
  debug: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
}

export type PluginEventBus = Pick<
  TypedEventEmitter<LunacordEvents>,
  "listenerCount" | "off" | "on" | "once"
>;

export interface PluginContext {
  readonly apiVersion: PluginApiVersion;
  readonly cache: Cache;
  readonly events: PluginEventBus;
  getPlayer: (guildId: string) => Player | undefined;
  readonly logger: PluginLogger;
  registerCommand: (command: PluginCommand) => void;
  registerMetric: (metric: PluginMetric) => void;
}

export interface PluginRestRequestContext extends RestRequestContext {
  nodeId: string;
}

export interface PluginRestResponseContext extends RestResponseContext {
  nodeId: string;
}

export interface PluginRestErrorHookContext extends RestErrorContext {
  nodeId: string;
}

export interface PluginSearchResultContext {
  guildId: string;
  nodeId: string;
  player: Player;
  provider?: SearchProviderInput;
  query: string;
}

export type PluginHookName =
  | "afterRestResponse"
  | "beforeRestRequest"
  | "dispose"
  | "observe"
  | "onPlayerRestore"
  | "onRestError"
  | "setup"
  | "start"
  | "stop"
  | "transformSearchResult";

export interface PluginHookTimeouts extends Partial<Record<PluginHookName, number>> {}

export interface PluginErrorEvent {
  error: Error;
  guildId?: string;
  hook: PluginHookName;
  nodeId?: string;
  plugin: {
    apiVersion: string;
    name: string;
    version: string;
  };
}

export interface LunacordPlugin extends PluginMetadata {
  afterRestResponse?: (
    context: PluginRestResponseContext,
    pluginContext: PluginContext
  ) => MaybePromise<unknown | undefined>;
  beforeRestRequest?: (
    context: PluginRestRequestContext,
    pluginContext: PluginContext
  ) => MaybePromise<RestRequestPatch | undefined>;
  dispose?: (pluginContext: PluginContext) => MaybePromise<void>;
  observe?: (event: LunacordPluginEvent, pluginContext: PluginContext) => MaybePromise<void>;
  /**
   * Called when the persistence layer rehydrates a player snapshot after bot restart
   * (API v2+). Plugins can use this to re-run any post-restore setup (re-registering
   * listeners, re-issuing API calls, emitting analytics, etc.).
   */
  onPlayerRestore?: (
    context: { guildId: string; player: Player; snapshot: unknown },
    pluginContext: PluginContext
  ) => MaybePromise<void>;
  onRestError?: (
    context: PluginRestErrorHookContext,
    pluginContext: PluginContext
  ) => MaybePromise<void>;
  setup?: (pluginContext: PluginContext) => MaybePromise<void>;
  start?: (pluginContext: PluginContext) => MaybePromise<void>;
  stop?: (pluginContext: PluginContext) => MaybePromise<void>;
  transformSearchResult?: (
    context: PluginSearchResultContext,
    result: SearchResult,
    pluginContext: PluginContext
  ) => MaybePromise<SearchResult>;
}

export interface PluginManagerOptions {
  cacheNamespace: (namespace: string) => Cache;
  events: PluginEventBus;
  getNodes: () => Node[];
  getPlayer: (guildId: string) => Player | undefined;
  logger?: {
    debug?: (message: string, data?: unknown) => void;
    error?: (message: string, data?: unknown) => void;
    warn?: (message: string, data?: unknown) => void;
  };
  onPluginError: (event: PluginErrorEvent) => void;
}
