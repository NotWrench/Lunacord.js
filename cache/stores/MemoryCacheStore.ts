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

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      this.entries.clear();
      return;
    }

    for (const key of this.entries.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        this.entries.delete(key);
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.entries.delete(key);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return null;
    }

    this.touchEntry(key, entry);

    return entry.value as T;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return false;
    }

    this.touchEntry(key, entry);

    return true;
  }

  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const ttlMs = options?.ttlMs;
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: typeof ttlMs === "number" ? Date.now() + ttlMs : null,
    });
    this.evictEntriesIfNeeded();
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
      if (!oldestKey) {
        return;
      }

      this.entries.delete(oldestKey);
    }
  }
}
