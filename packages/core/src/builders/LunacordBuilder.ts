import type { CacheOptions } from "../cache/types";
import type {
  AutoMigrateOptions,
  LunacordLogger,
  LunacordNodeOptions,
  LunacordNodeSelectionStrategy,
  LunacordOptions,
} from "../core/Lunacord";
import { Lunacord } from "../core/Lunacord";
import type { GatewayVoiceStatePayload } from "../core/Node";
import type { PersistenceAdapter } from "../persistence/PersistenceAdapter";
import type { WebSocketFactory } from "../transports/websocket/Socket";
import type { LyricsProvider } from "../types/lyrics";

/**
 * Fluent, builder-first entrypoint for constructing a {@link Lunacord} instance.
 *
 * Prefer this over `new Lunacord({...})` for day-to-day code; the constructor remains
 * available for tests and power users.
 *
 * ```ts
 * const lunacord = Lunacord.create()
 *   .userId(client.user!.id)
 *   .shards(1)
 *   .node({ id: "main", host: "localhost", port: 2333, password: "..." })
 *   .resume(true)
 *   .nodeSelection.leastLoaded()
 *   .build();
 * ```
 */
export class LunacordBuilder {
  private readonly draft: LunacordOptions & { nodes: LunacordNodeOptions[] } = {
    nodes: [],
  };

  /** Nested namespace of node-selection strategy presets. */
  readonly nodeSelection = {
    leastLoaded: (): this => {
      this.draft.nodeSelection = { type: "leastLoaded" };
      return this;
    },
    roundRobin: (): this => {
      this.draft.nodeSelection = { type: "roundRobin" };
      return this;
    },
    weighted: (weights?: {
      cpuWeight?: number;
      memoryWeight?: number;
      playerWeight?: number;
    }): this => {
      this.draft.nodeSelection = { type: "weighted", ...weights };
      return this;
    },
    region: (
      fallback?: LunacordNodeSelectionStrategy & { type: "region" } extends { fallback: infer F }
        ? F
        : never
    ): this => {
      this.draft.nodeSelection = {
        type: "region",
        ...(fallback === undefined ? {} : { fallback }),
      } as LunacordNodeSelectionStrategy;
      return this;
    },
    failover: (order: readonly string[]): this => {
      this.draft.nodeSelection = { type: "failover", order };
      return this;
    },
    custom: (strategy: LunacordNodeSelectionStrategy): this => {
      this.draft.nodeSelection = strategy;
      return this;
    },
  };

  /** Nested namespace of cache presets. */
  readonly cache = {
    disabled: (): this => {
      this.draft.cache = { enabled: false };
      return this;
    },
    memory: (options?: Omit<CacheOptions, "store">): this => {
      this.draft.cache = { enabled: true, ...options };
      return this;
    },
    custom: (options: CacheOptions): this => {
      this.draft.cache = options;
      return this;
    },
  };

  userId(userId: string): this {
    this.draft.userId = userId;
    return this;
  }

  shards(numShards: number): this {
    this.draft.numShards = numShards;
    return this;
  }

  clientName(name: string): this {
    this.draft.clientName = name;
    return this;
  }

  node(node: LunacordNodeOptions): this {
    this.draft.nodes.push(node);
    return this;
  }

  nodes(nodes: readonly LunacordNodeOptions[]): this {
    this.draft.nodes.push(...nodes);
    return this;
  }

  resume(resume: boolean, timeoutSeconds?: number): this {
    this.draft.resume = resume;
    if (timeoutSeconds !== undefined) {
      this.draft.timeout = timeoutSeconds;
    }
    return this;
  }

  autoConnect(autoConnect = true): this {
    this.draft.autoConnect = autoConnect;
    return this;
  }

  autoMigrate(options: true | AutoMigrateOptions = true): this {
    this.draft.autoMigrateOnDisconnect = options;
    return this;
  }

  logger(logger: LunacordLogger): this {
    this.draft.logger = logger;
    return this;
  }

  lyrics(provider: LyricsProvider): this {
    this.draft.lyrics = provider;
    return this;
  }

  persistence(adapter: PersistenceAdapter): this {
    this.draft.persistence = adapter;
    return this;
  }

  sendGatewayPayload(
    fn: (guildId: string, payload: GatewayVoiceStatePayload) => void | Promise<void>
  ): this {
    this.draft.sendGatewayPayload = fn;
    return this;
  }

  webSocketFactory(factory: WebSocketFactory): this {
    this.draft.webSocketFactory = factory;
    return this;
  }

  build(): Lunacord {
    return new Lunacord(this.draft);
  }
}
