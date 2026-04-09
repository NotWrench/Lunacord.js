export interface CacheSetOptions {
  ttlMs?: number;
}

export interface CacheNamespaceOptions {
  defaultTtlMs?: number;
  logger?: CacheLogger;
}

export interface CacheLogger {
  debug?: (message: string, data?: unknown) => void;
  error?: (message: string, data?: unknown) => void;
  warn?: (message: string, data?: unknown) => void;
}

export interface CacheStore {
  clear(prefix?: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  get<T>(key: string): Promise<T | null>;
  has(key: string): Promise<boolean>;
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
}

export interface CacheEntry<T> {
  expiresAt: number | null;
  value: T;
}

export type CacheResolver<T> = () => Promise<T> | T;

export interface MemoryCacheOptions {
  cleanupIntervalMs?: number;
  maxEntries?: number;
}

export interface CacheOptions {
  defaultTtlMs?: number;
  enabled?: boolean;
  logger?: CacheLogger;
  memory?: MemoryCacheOptions;
  prefix?: string;
  store?: CacheStore;
}
