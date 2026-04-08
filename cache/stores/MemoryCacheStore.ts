import type { CacheEntry, CacheSetOptions, MemoryCacheOptions } from "../types";

export class MemoryCacheStore {
  private readonly cleanupIntervalMs?: number;
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: MemoryCacheOptions) {
    this.cleanupIntervalMs = options?.cleanupIntervalMs;

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

    return true;
  }

  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const ttlMs = options?.ttlMs;
    this.entries.set(key, {
      value,
      expiresAt: typeof ttlMs === "number" ? Date.now() + ttlMs : null,
    });
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
}
