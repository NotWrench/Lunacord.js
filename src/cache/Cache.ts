import type {
  CacheLogger,
  CacheNamespaceOptions,
  CacheResolver,
  CacheSetOptions,
  CacheStore,
} from "./types";

const joinNamespace = (prefix: string, key: string): string => (prefix ? `${prefix}:${key}` : key);

export class Cache {
  private readonly defaultTtlMs?: number;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly logger?: CacheLogger;
  private readonly prefix: string;
  private readonly store: CacheStore;

  constructor(store: CacheStore, prefix = "", options?: CacheNamespaceOptions) {
    this.store = store;
    this.prefix = prefix;
    this.defaultTtlMs = options?.defaultTtlMs;
    this.logger = options?.logger;
  }

  async clear(): Promise<void> {
    this.inFlight.clear();

    try {
      await this.store.clear(this.getPrefix());
    } catch {
      this.logger?.warn?.("Cache clear failed", {
        prefix: this.prefix,
      });
      // Cache failures should not break primary flows.
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      return await this.store.delete(this.getStoreKey(key));
    } catch {
      this.logger?.warn?.("Cache delete failed", {
        key: this.getStoreKey(key),
      });
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.store.get<T>(this.getStoreKey(key));
      this.logger?.debug?.(value === null ? "Cache miss" : "Cache hit", {
        key: this.getStoreKey(key),
      });
      return value;
    } catch {
      this.logger?.warn?.("Cache get failed", {
        key: this.getStoreKey(key),
      });
      return null;
    }
  }

  async getOrSet<T>(
    key: string,
    resolver: CacheResolver<T>,
    options?: CacheSetOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    return this.wrap(key, resolver, options);
  }

  async has(key: string): Promise<boolean> {
    try {
      return await this.store.has(this.getStoreKey(key));
    } catch {
      return false;
    }
  }

  namespace(name: string, options?: CacheNamespaceOptions): Cache {
    return new Cache(this.store, joinNamespace(this.prefix, name), {
      defaultTtlMs: options?.defaultTtlMs ?? this.defaultTtlMs,
      logger: options?.logger ?? this.logger,
    });
  }

  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    try {
      await this.store.set(this.getStoreKey(key), value, {
        ttlMs: options?.ttlMs ?? this.defaultTtlMs,
      });
      this.logger?.debug?.("Cache set", {
        key: this.getStoreKey(key),
        ttlMs: options?.ttlMs ?? this.defaultTtlMs ?? null,
      });
    } catch {
      this.logger?.warn?.("Cache set failed", {
        key: this.getStoreKey(key),
      });
      // Cache failures should not break primary flows.
    }
  }

  async wrap<T>(key: string, resolver: CacheResolver<T>, options?: CacheSetOptions): Promise<T> {
    const storeKey = this.getStoreKey(key);
    const activeRequest = this.inFlight.get(storeKey);
    if (activeRequest) {
      return activeRequest as Promise<T>;
    }

    const request = Promise.resolve()
      .then(resolver)
      .then(async (value) => {
        await this.set(key, value, options);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(storeKey);
      });

    this.inFlight.set(storeKey, request);
    return request;
  }

  private getPrefix(): string | undefined {
    return this.prefix || undefined;
  }

  private getStoreKey(key: string): string {
    return joinNamespace(this.prefix, key);
  }
}
