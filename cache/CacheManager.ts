import { Cache } from "./Cache";
import { MemoryCacheStore } from "./stores/MemoryCacheStore";
import { NoopCacheStore } from "./stores/NoopCacheStore";
import type { CacheNamespaceOptions, CacheOptions, CacheStore } from "./types";

export class CacheManager {
  private readonly defaultTtlMs?: number;
  private readonly prefix: string;
  private readonly rootCache: Cache;
  private readonly store: CacheStore;

  constructor(options?: CacheOptions) {
    this.defaultTtlMs = options?.defaultTtlMs;
    this.prefix = options?.prefix?.trim() ?? "";
    this.store = this.createStore(options);
    this.rootCache = new Cache(this.store, this.prefix, {
      defaultTtlMs: this.defaultTtlMs,
      logger: options?.logger,
    });
  }

  cache(name: string, options?: CacheNamespaceOptions): Cache {
    return this.rootCache.namespace(name, options);
  }

  async clearAll(): Promise<void> {
    await this.rootCache.clear();
  }

  getStore(): CacheStore {
    return this.store;
  }

  private createStore(options?: CacheOptions): CacheStore {
    if (options?.store) {
      return options.store;
    }

    if (options?.enabled === false) {
      return new NoopCacheStore();
    }

    return new MemoryCacheStore(options?.memory);
  }
}
