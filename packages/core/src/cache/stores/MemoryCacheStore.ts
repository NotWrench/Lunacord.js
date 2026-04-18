import type { CacheEntry, CacheSetOptions, MemoryCacheOptions } from "../types";

export class MemoryCacheStore {
  private readonly cleanupIntervalMs?: number;
  private readonly maxEntries?: number;
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: MemoryCacheOptions) {
    this.cleanupIntervalMs = options?.cleanupIntervalMs;
    this.maxEntries =
      typeof options?.maxEntries === "number" && options.maxEntries > 0
        ? options.maxEntries
        : undefined;

    if (this.cleanupIntervalMs && this.cleanupIntervalMs > 0) {
      const timer = setInterval(() => {
        this.sweepExpiredEntries();
      }, this.cleanupIntervalMs);

      if (typeof timer === "object" && timer !== null && "unref" in timer) {
        const maybeUnref = timer.unref;
        if (typeof maybeUnref === "function") {
          maybeUnref.call(timer);
        }
      }

      this.sweepTimer = timer;
    }
  }

  clear(prefix?: string): Promise<void> {
    if (!prefix) {
      this.entries.clear();
      return Promise.resolve();
    }

    for (const key of this.entries.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        this.entries.delete(key);
      }
    }
    return Promise.resolve();
  }

  delete(key: string): Promise<boolean> {
    return Promise.resolve(this.entries.delete(key));
  }

  get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return Promise.resolve(null);
    }

    this.touchEntry(key, entry);
    return Promise.resolve(entry.value as T);
  }

  has(key: string): Promise<boolean> {
    const entry = this.entries.get(key);
    if (!entry) {
      return Promise.resolve(false);
    }

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return Promise.resolve(false);
    }

    this.touchEntry(key, entry);
    return Promise.resolve(true);
  }

  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const ttlMs = options?.ttlMs;
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: typeof ttlMs === "number" ? Date.now() + ttlMs : null,
    });
    this.evictEntriesIfNeeded();
    return Promise.resolve();
  }

  stop(): void {
    if (!this.sweepTimer) {
      return;
    }

    clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  private sweepExpiredEntries(): void {
    for (const [key, entry] of this.entries.entries()) {
      if (this.isExpired(entry)) {
        this.entries.delete(key);
      }
    }
  }

  private touchEntry(key: string, entry: CacheEntry<unknown>): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private evictEntriesIfNeeded(): void {
    if (!this.maxEntries) {
      return;
    }

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        return;
      }

      this.entries.delete(oldestKey);
    }
  }
}
